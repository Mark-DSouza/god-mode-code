package dev.markdsouza.godmodecode.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Everything on the site is open except the one request that attaches
 * credentials to a User (ADR-0011). Nothing else needs a bearer token: Runs,
 * Leaderboards and the Profile are all read or written against whichever User
 * the Recognition Key cookie names, Claimed or not (ADR-0007).
 */
@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // No server-side session and no form anywhere on the site
                // (ADR-0002) — CSRF tokens defend a session cookie a browser
                // sends automatically, and there is not one. The Recognition
                // cookie's SameSite=Lax already stops it travelling on a
                // cross-site POST.
                .csrf(AbstractHttpConfigurer::disable)
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
}
