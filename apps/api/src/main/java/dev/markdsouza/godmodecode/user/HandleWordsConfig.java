package dev.markdsouza.godmodecode.user;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

/**
 * Loads the committed word lists.
 *
 * A bean rather than a field, so a test can install a list of its own — which is
 * how the collision behaviour is driven from the HTTP boundary without either
 * mocking the generator or creating twelve thousand Users to force a clash.
 */
@Configuration
public class HandleWordsConfig {

    @Bean
    HandleWords handleWords() {
        // Validation happens in the record's constructor, so a word list that
        // breaks the length budget fails the application's startup rather than
        // one Leaderboard row, months later.
        return new HandleWords(read("handles/gerunds.txt"), read("handles/creatures.txt"));
    }

    private static List<String> read(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines()
                    .map(String::trim)
                    // The files carry the curation rules at the top, so whoever
                    // adds a word reads them first.
                    .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the word list at " + path, e);
        }
    }
}
