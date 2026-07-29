package dev.markdsouza.godmodecode.typing;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import dev.markdsouza.godmodecode.Browser;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Being handed something to type, driven through the HTTP boundary against a
 * real PostgreSQL.
 */
class ChallengeEndpointTest extends AbstractIntegrationTest {

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @ParameterizedTest
    @EnumSource(
            value = Discipline.class,
            names = {"QUOTES", "PROSE"})
    @DisplayName("both transcription Disciplines hand out a Passage through the same mechanism")
    void bothTranscriptionDisciplinesIssueAPassage(Discipline discipline) {
        Browser browser = Browser.arrivingAt(http);

        ResponseEntity<Challenge> response = browser.asksFor(discipline);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Challenge challenge = response.getBody();
        assertThat(challenge).isNotNull();
        assertThat(challenge.issueId()).isNotNull();

        Passage passage = challenge.passage();
        // Quotes and Prose differ by which rows they draw from and by nothing
        // else — same payload, same endpoint, same Issue (ADR-0006 keeps Solve
        // Runs separate; these two are the same thing twice).
        assertThat(passage.discipline()).isEqualTo(discipline);
        assertThat(passage.text()).isNotBlank();
        assertThat(passage.attribution()).isNotBlank();
        // Derived by the database from the text itself, so the two cannot drift.
        assertThat(passage.characterCount()).isEqualTo(passage.text().length());
        // Every character has to be one a player can actually produce; a Run
        // only ends when the final character is typed.
        assertThat(passage.text()).matches("^[ -~]+$");
    }

    @Test
    @DisplayName("the Issue is recorded against the User, with the server's own clock")
    void theIssueIsRecordedAgainstTheUser() {
        Browser browser = Browser.arrivingAt(http);
        Instant beforeTheRequest = Instant.now().minusSeconds(5);

        Challenge challenge = browser.isHanded(Discipline.QUOTES);

        UUID storedUser = jdbc.queryForObject(
                "SELECT user_id FROM issues WHERE id = ?", UUID.class, challenge.issueId());
        assertThat(storedUser).isEqualTo(browser.user().id());

        // Server-owned, not sent by the caller: this timestamp is the anchor
        // every later duration is measured against (ADR-0003), and a client that
        // could set it could claim to have started an hour ago.
        Instant issuedAt = issuedAt(challenge);
        assertThat(issuedAt).isAfter(beforeTheRequest).isBeforeOrEqualTo(Instant.now());
        assertThat(challenge.expiresAt()).isAfter(issuedAt);
    }

    @Test
    @DisplayName("the window is never shorter than ten minutes, however short the Passage")
    void theWindowIsNeverShorterThanTenMinutes() {
        Browser browser = Browser.arrivingAt(http);

        Challenge challenge = browser.isHanded(Discipline.QUOTES);

        // The floor is what stops a generous rule becoming a stopwatch: at the
        // twenty-words-per-minute the window is scaled against, a short
        // quotation would otherwise expire in under two minutes (ADR-0003).
        assertThat(Duration.between(issuedAt(challenge), challenge.expiresAt()))
                .isGreaterThanOrEqualTo(Duration.ofMinutes(10));
    }

    @Test
    @DisplayName("the window is the one the length of this Passage earns")
    void theWindowScalesWithTheLengthOfThePassage() {
        Browser browser = Browser.arrivingAt(http);

        Challenge challenge = browser.isHanded(Discipline.PROSE);

        // Asserted against the rule rather than against a number, because which
        // Passage arrives is the server's choice. What this pins down is that
        // the rule reaches the row at all — `Expiry` itself is pinned by
        // ExpiryTest, where the arithmetic can be stated outright.
        assertThat(Duration.between(issuedAt(challenge), challenge.expiresAt()))
                .isEqualTo(Expiry.forPassageOf(challenge.passage().characterCount()));
    }

    @Test
    @DisplayName("asking again abandons the Challenge you were holding")
    void askingAgainAbandonsTheChallengeYouWereHolding() {
        Browser browser = Browser.arrivingAt(http);

        Challenge first = browser.isHanded(Discipline.QUOTES);
        Challenge second = browser.isHanded(Discipline.PROSE);

        assertThat(second.issueId()).isNotEqualTo(first.issueId());

        // One live Issue per User (ADR-0003). Holding several and submitting
        // whichever went best is exactly what this forecloses; skipping a
        // Passage you do not fancy still costs nothing.
        Integer live = jdbc.queryForObject(
                """
                SELECT count(*) FROM issues
                WHERE user_id = ? AND consumed_at IS NULL AND superseded_at IS NULL
                """,
                Integer.class,
                browser.user().id());
        assertThat(live).isEqualTo(1);

        // Abandoned, not consumed: no Run was ever played against it, and
        // collapsing the two would make that unanswerable.
        assertThat(jdbc.queryForObject(
                        "SELECT superseded_at IS NOT NULL AND consumed_at IS NULL FROM issues WHERE id = ?",
                        Boolean.class,
                        first.issueId()))
                .isTrue();
    }

    @Test
    @DisplayName("the Code Discipline has no Passages to hand out")
    void codeHasNoPassages() {
        Browser browser = Browser.arrivingAt(http);

        // Code is Pattern puzzles, judged by running submitted source against
        // hidden tests (ADR-0004). There is no Passage to transcribe and there
        // never will be, so the honest answer is that there is nothing here.
        assertThat(browser.asksFor(Discipline.CODE).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("a browser that is nobody yet cannot be handed a Challenge")
    void aBrowserThatIsNobodyCannotBeHandedAChallenge() {
        // A Run has to belong to a User (ADR-0007), and an Issue is recorded
        // against one — so there is nothing to record this against.
        ResponseEntity<String> response = http.postForEntity(
                "/api/challenges", new ChallengeRequest(Discipline.QUOTES), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private Instant issuedAt(Challenge challenge) {
        return jdbc.queryForObject(
                        "SELECT issued_at FROM issues WHERE id = ?",
                        OffsetDateTime.class,
                        challenge.issueId())
                .toInstant();
    }
}
