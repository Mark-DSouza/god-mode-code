package dev.markdsouza.godmodecode.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Every state-changing request needs a CSRF token; only the one that attaches
 * credentials to a User also needs a bearer token (ADR-0011). Everything else
 * is read or written against whichever User the Recognition Key cookie names,
 * Claimed or not (ADR-0007).
 */
@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, @Value("${gmc.cookie-secure:true}") boolean cookieSecure)
            throws Exception {
        CookieCsrfTokenRepository csrfTokens = CookieCsrfTokenRepository.withHttpOnlyFalse();
        // JavaScript has to read this one — it is the value the SPA echoes back
        // in a header — so HttpOnly is off deliberately, unlike the Recognition
        // cookie next to it. Otherwise the same posture: Secure whenever this
        // deployment is (which is always, outside local development), and Lax
        // for the same reason the Recognition cookie is: there is exactly one
        // origin, so nothing legitimate sends this cross-site.
        csrfTokens.setCookieCustomizer(cookie -> cookie.secure(cookieSecure).sameSite("Lax").path("/"));

        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokens)
                        // No server-rendered form anywhere on this site
                        // (ADR-0002), so the token is never expected back as a
                        // request parameter — only as the header the SPA sets
                        // from the cookie above. The plain handler is what
                        // makes that comparison a straight string match; the
                        // default handler expects a BREACH-masked value, which
                        // exists to protect a token reflected into HTML the
                        // page renders, and nothing here ever does that.
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                // Spring Security loads the CSRF token lazily — nothing here
                // reads the request attribute the way a server-rendered form
                // would, so without forcing it, the cookie above is never
                // written and the SPA has nothing to read back.
                .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/users/claim")
                        .authenticated()
                        .anyRequest()
                        .permitAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> {}));
        return http.build();
    }

    /**
     * Fetches the identity provider's signing keys once, at startup, from its
     * issuer.
     *
     * A blank issuer means no identity provider is configured for this
     * environment — every local and CI run, until a real Cognito user pool is
     * provisioned — and {@link JwtDecoders#fromIssuerLocation} would otherwise
     * make a network call at startup that has nowhere to go. The decoder
     * returned instead simply refuses every token, which only matters to the
     * one endpoint above that requires one.
     */
    @Bean
    JwtDecoder jwtDecoder(@Value("${gmc.auth.issuer-uri:}") String issuerUri) {
        if (issuerUri.isBlank()) {
            return token -> {
                throw new JwtException("Sign-in is not configured in this environment");
            };
        }
        return JwtDecoders.fromIssuerLocation(issuerUri);
    }

    /** Forces the deferred CSRF token to render on every request, which is what actually writes its cookie. */
    private static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(
                HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                throws ServletException, IOException {
            CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (csrfToken != null) {
                // The read is the side effect: a DeferredCsrfToken only asks
                // the repository to generate-or-load and save the token the
                // first time something calls getToken().
                csrfToken.getToken();
            }
            filterChain.doFilter(request, response);
        }
    }
}
