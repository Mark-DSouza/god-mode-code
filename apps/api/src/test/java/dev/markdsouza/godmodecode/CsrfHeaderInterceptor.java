package dev.markdsouza.godmodecode;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.support.HttpRequestWrapper;

/**
 * What a browser does for free — hold the CSRF cookie, echo it back as a
 * header — done by hand, because {@link org.springframework.boot.test.web.client.TestRestTemplate}
 * keeps no cookie jar (see {@link Browser}'s own javadoc for the Recognition
 * Key half of the same problem).
 *
 * Installed once, in {@link AbstractIntegrationTest}, rather than threaded
 * through every test's request-building — the same reasoning that centralised
 * the Recognition Key cookie in {@link Browser} rather than every test method.
 * A token this suite fetches once stays valid for the rest of it: {@code
 * CookieCsrfTokenRepository} reuses whatever token a request already presents
 * rather than rotating it, so there is nothing to refresh.
 */
final class CsrfHeaderInterceptor implements ClientHttpRequestInterceptor {

    private static final String COOKIE_NAME = "XSRF-TOKEN";
    private static final String HEADER_NAME = "X-XSRF-TOKEN";

    private volatile String token;

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        if (needsToken(request.getMethod())) {
            if (token == null) {
                token = fetchToken(request, execution);
            }
            attach(request, token);
        }
        return execution.execute(request, body);
    }

    private static boolean needsToken(HttpMethod method) {
        return method == HttpMethod.POST
                || method == HttpMethod.PUT
                || method == HttpMethod.PATCH
                || method == HttpMethod.DELETE;
    }

    /** A GET to any endpoint carries the same CSRF cookie a POST would need — health is the cheapest one that exists. */
    private static String fetchToken(HttpRequest original, ClientHttpRequestExecution execution) throws IOException {
        HttpRequest priming = new HttpRequestWrapper(original) {
            private final HttpHeaders headers = new HttpHeaders();

            @Override
            public HttpMethod getMethod() {
                return HttpMethod.GET;
            }

            @Override
            public URI getURI() {
                return original.getURI().resolve("/api/health");
            }

            @Override
            public HttpHeaders getHeaders() {
                return headers;
            }
        };

        try (ClientHttpResponse response = execution.execute(priming, new byte[0])) {
            return extractToken(response.getHeaders().get(HttpHeaders.SET_COOKIE));
        }
    }

    private static String extractToken(List<String> setCookieHeaders) {
        if (setCookieHeaders != null) {
            for (String header : setCookieHeaders) {
                if (header.startsWith(COOKIE_NAME + "=")) {
                    return header.split(";", 2)[0].substring(COOKIE_NAME.length() + 1);
                }
            }
        }
        throw new IllegalStateException("No " + COOKIE_NAME + " cookie was issued");
    }

    private static void attach(HttpRequest request, String token) {
        HttpHeaders headers = request.getHeaders();
        List<String> existingCookies = headers.get(HttpHeaders.COOKIE);
        String cookiePair = COOKIE_NAME + "=" + token;
        headers.set(
                HttpHeaders.COOKIE,
                existingCookies == null || existingCookies.isEmpty()
                        ? cookiePair
                        : String.join("; ", existingCookies) + "; " + cookiePair);
        headers.set(HEADER_NAME, token);
    }
}
