package dev.markdsouza.godmodecode.typing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The expiry rule stated outright.
 *
 * No Spring and no database: this is arithmetic, and it is the arithmetic that
 * decides whether an honest slow typist keeps their Run (ADR-0003). The endpoint
 * test proves the rule reaches the row; this one proves the rule.
 */
class ExpiryTest {

    @Test
    @DisplayName("a short Passage still gets the ten-minute floor")
    void aShortPassageGetsTheFloor() {
        // 150 characters is 30 words, which at twenty words per minute is 90
        // seconds. Plus grace that is still under four minutes, so the floor is
        // what answers.
        assertThat(Expiry.forPassageOf(150)).isEqualTo(Duration.ofMinutes(10));
    }

    @Test
    @DisplayName("a long Passage gets the time it earns at twenty words per minute, plus grace")
    void aLongPassageScalesWithItsLength() {
        // 3000 characters is 600 words. At twenty words per minute that is
        // thirty minutes of typing, and the two minutes of grace go on top.
        assertThat(Expiry.forPassageOf(3000)).isEqualTo(Duration.ofMinutes(32));
    }

    @Test
    @DisplayName("the floor gives way exactly where the scaled time overtakes it")
    void theFloorGivesWayWhereTheScaledTimeOvertakesIt() {
        // Eight minutes of typing at the floor speed is 160 words, or 800
        // characters — which with grace is exactly the ten-minute floor. One
        // character more has to be more than ten minutes, or the floor is
        // silently clamping Passages it should have stopped governing.
        assertThat(Expiry.forPassageOf(800)).isEqualTo(Duration.ofMinutes(10));
        assertThat(Expiry.forPassageOf(805)).isGreaterThan(Duration.ofMinutes(10));
    }

    @Test
    @DisplayName("the window never shrinks as the Passage grows")
    void theWindowNeverShrinksAsThePassageGrows() {
        Duration previous = Duration.ZERO;
        for (int characters = 100; characters <= 4000; characters += 25) {
            Duration window = Expiry.forPassageOf(characters);
            assertThat(window)
                    .as("a %d-character Passage got less time than a shorter one", characters)
                    .isGreaterThanOrEqualTo(previous);
            previous = window;
        }
    }
}
