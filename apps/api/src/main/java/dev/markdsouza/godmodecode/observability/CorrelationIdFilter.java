package dev.markdsouza.godmodecode.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Puts a correlation id on every request, and is the one place an unhandled
 * failure is written down.
 *
 * Both jobs belong here for the same reason: this filter is the outermost thing
 * in the chain that still knows which request it is looking at. Logging the
 * failure any deeper means logging it without the request; logging it any
 * shallower means Tomcat has already reset the response.
 *
 * It deliberately does not turn the failure into a response body. Spring's own
 * error handling does that, and it is configured to say nothing about what went
 * wrong — the answer belongs in the log stream, not in a stranger's browser.
 */
@Component
// Ahead of anything that might log, so every line a request produces carries
// the id. Not HIGHEST_PRECEDENCE itself: that slot belongs to the filters that
// decide whether a request is allowed to proceed at all.
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
class CorrelationIdFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(CorrelationIdFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String correlationId = CorrelationId.from(request.getHeader(CorrelationId.CLOUDFLARE_HEADER));
        MDC.put(CorrelationId.MDC_KEY, correlationId);
        response.setHeader(CorrelationId.HEADER, correlationId);

        try {
            chain.doFilter(request, response);
        } catch (Exception failure) {
            // Key-values rather than an interpolated message: the structured
            // formatter writes them as fields, which is what makes "every
            // failure on this path" a query rather than a grep.
            log.atError()
                    .setCause(rootCauseOf(failure))
                    .addKeyValue("http.request.method", request.getMethod())
                    .addKeyValue("url.path", request.getRequestURI())
                    .setMessage("request failed")
                    .log();
            throw failure;
        } finally {
            // Servlet containers reuse threads. An id left on one is attached
            // to whichever unrelated request lands there next, which is worse
            // than no id at all — it is a confident wrong answer.
            MDC.remove(CorrelationId.MDC_KEY);
        }
    }

    /**
     * Spring wraps anything a controller throws in a {@link ServletException}
     * before it reaches a filter. Logging that wrapper would type every failure
     * in the application as `jakarta.servlet.ServletException`, which is the
     * one thing they all have in common and therefore says nothing. The wrapper
     * is unwrapped for the log only — the original is what gets rethrown, so
     * the container's own error handling sees exactly what it expects.
     */
    private static Throwable rootCauseOf(Exception failure) {
        if (failure instanceof ServletException servletFailure && servletFailure.getRootCause() != null) {
            return servletFailure.getRootCause();
        }
        return failure;
    }
}
