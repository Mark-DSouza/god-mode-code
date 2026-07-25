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
        // Shape and length are the record's own invariants, so a word list that
        // breaks the budget fails the application's startup rather than one
        // Leaderboard row, months later.
        HandleWords words = new HandleWords(read("handles/gerunds.txt"), read("handles/creatures.txt"));

        // Size is checked here instead, because it is a property of the
        // committed lists rather than of the type: the collision tests build a
        // legitimate one-pair HandleWords, and a rule with an exemption for
        // small lists would wave through a production list truncated to one
        // word — the exact accident worth catching.
        if (words.distinctPairs() < HandleWords.MIN_DISTINCT_PAIRS) {
            throw new IllegalStateException("The committed word lists make only "
                    + words.distinctPairs() + " Handles; below " + HandleWords.MIN_DISTINCT_PAIRS
                    + " the collision suffix stops being the exception");
        }
        return words;
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
