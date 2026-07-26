package dev.markdsouza.godmodecode.judge;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How the backend reaches the judge.
 *
 * @param baseUrl        the judge's address on the private link. In production a
 *                       fixed private address that Terraform pins, so replacing
 *                       the judge does not require redeploying the backend.
 * @param connectTimeout how long to wait for the socket. Short: the judge is one
 *                       hop away inside the VPC, so a slow connect is a dead
 *                       host rather than a busy one.
 * @param timeout        the hard deadline on one judging. See
 *                       {@link JudgeClient} for the arithmetic behind the
 *                       default.
 * @param pollTimeout    the deadline on a health probe or metric scrape.
 *                       Deliberately far shorter than {@code timeout}: a monitor
 *                       that blocks for the judging deadline stops being a
 *                       monitor.
 * @param pollInterval   how often the judge is probed and scraped.
 * @param staleAfter     how long a successful probe stays believable. Past this
 *                       the judge is reported degraded, because a monitor that
 *                       has stopped running must not read as good news.
 */
@ConfigurationProperties("gmc.judge")
public record JudgeProperties(
        @DefaultValue("http://localhost:9090") URI baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("45s") Duration timeout,
        @DefaultValue("2s") Duration pollTimeout,
        @DefaultValue("15s") Duration pollInterval,
        @DefaultValue("60s") Duration staleAfter) {}
