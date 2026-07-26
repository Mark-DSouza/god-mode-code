package dev.markdsouza.godmodecode.typing;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The content ships as migrations, so a fresh database is a working one.
 *
 * This test is the claim that "clone the repository and run one command" ends
 * with something playable rather than with an empty catalogue and a 404.
 */
class PassageCatalogueTest extends AbstractIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("both transcription Disciplines have Passages, without anyone seeding them")
    void bothTranscriptionDisciplinesHavePassages() {
        Map<String, Integer> counts = jdbc
                .queryForList("SELECT discipline, count(*) AS n FROM passages GROUP BY discipline")
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (String) row.get("discipline"), row -> ((Number) row.get("n")).intValue()));

        // Enough that the same Passage does not arrive twice in a row often
        // enough to be annoying. Remembering what a player has already been given
        // is a later ticket; a catalogue with something in it is this one.
        assertThat(counts).containsOnlyKeys("QUOTES", "PROSE");
        assertThat(counts.get("QUOTES")).isGreaterThanOrEqualTo(10);
        assertThat(counts.get("PROSE")).isGreaterThanOrEqualTo(10);
    }

    @Test
    @DisplayName("every Passage is typeable, counted and attributed")
    void everyPassageIsTypeableCountedAndAttributed() {
        List<Map<String, Object>> passages =
                jdbc.queryForList("SELECT text, attribution, character_count FROM passages");

        assertThat(passages).isNotEmpty();
        for (Map<String, Object> passage : passages) {
            String text = (String) passage.get("text");

            // A Run ends when the final character is typed, so one glyph a
            // player cannot produce makes the whole Passage impossible. Curly
            // quotes and em dashes are the two that creep in from source texts.
            assertThat(text)
                    .as("this Passage contains a character a keyboard cannot produce")
                    .matches("^[ -~]+$");

            // Derived by the database, so this is really a check that nothing
            // has taught it to disagree.
            assertThat(passage.get("character_count")).isEqualTo(text.length());

            assertThat((String) passage.get("attribution"))
                    .as("a quotation nobody said is not a quotation")
                    .isNotBlank();
        }
    }
}
