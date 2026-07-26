package dev.markdsouza.godmodecode.judge;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;

/**
 * Wiring for the private link to the judge.
 *
 * The two clients differ in exactly one thing — how long they will wait — and
 * that difference is the point of having two. A judging can legitimately take
 * most of a minute; a health probe that waited that long would turn a wedged
 * judge into a monitor that never reports anything.
 */
@Configuration
@EnableConfigurationProperties(JudgeProperties.class)
// Scheduling exists in this application for one reason: polling the judge. If
// something else ever needs it, this annotation should move somewhere with a
// less specific name than "the judge's configuration".
@EnableScheduling
public class JudgeConfiguration {

    /**
     * One HTTP client behind both request factories, so the connection to the
     * judge is pooled rather than re-established by whichever caller got there
     * first. The connect timeout belongs here because it is a property of
     * dialling the host, which is the same act for both.
     */
    @Bean
    HttpClient judgeHttpClient(JudgeProperties properties) {
        return HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                // The judge speaks HTTP/1.1 and nothing else. Left to negotiate,
                // the JDK client attempts an HTTP/2 upgrade on every request,
                // which costs a round trip on a link where every round trip is
                // inside a Solve Run's waiting time.
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    /**
     * The client Solve Runs go through.
     *
     * 45 seconds is derived rather than chosen: the judge waits up to 30 for a
     * worker before refusing, then bounds the execution at 10 by its own wall
     * clock, and the container takes a moment to start. A shorter deadline here
     * would abandon Solve Runs the judge was still going to answer — and it
     * would abandon them under load, which is when the difference between "slow"
     * and "broken" matters most.
     *
     * It is deliberately not a comfortable wait for a player. Bringing it down
     * means lowering the judge's queue wait first, not clipping the deadline
     * underneath it.
     */
    @Bean
    RestClient judgingRestClient(HttpClient judgeHttpClient, JudgeProperties properties) {
        return judgeClient(judgeHttpClient, properties, properties.timeout());
    }

    /** The client the monitor probes with, on a deadline it can poll at. */
    @Bean
    RestClient monitoringRestClient(HttpClient judgeHttpClient, JudgeProperties properties) {
        return judgeClient(judgeHttpClient, properties, properties.pollTimeout());
    }

    private static RestClient judgeClient(HttpClient http, JudgeProperties properties, Duration deadline) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        // Maps to `HttpRequest.timeout`, which bounds the whole exchange up to
        // the response arriving — not a socket read timeout that a trickling
        // response could extend indefinitely. Both endpoints behind this client
        // answer in one small JSON document, so that is the whole response.
        factory.setReadTimeout(deadline);
        return RestClient.builder()
                .baseUrl(properties.baseUrl().toString())
                .requestFactory(factory)
                .build();
    }

    /**
     * A clock, so staleness can be tested without waiting for it.
     *
     * {@code systemUTC} rather than the default zone: nothing here formats a
     * time for a person, and an instant is an instant.
     */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
