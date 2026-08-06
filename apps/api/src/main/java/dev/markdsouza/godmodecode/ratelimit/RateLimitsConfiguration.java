package dev.markdsouza.godmodecode.ratelimit;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(RateLimitsProperties.class)
public class RateLimitsConfiguration {}
