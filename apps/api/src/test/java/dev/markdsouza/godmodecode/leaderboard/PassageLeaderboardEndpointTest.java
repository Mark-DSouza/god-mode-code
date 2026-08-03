package dev.markdsouza.godmodecode.leaderboard;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import dev.markdsouza.godmodecode.Browser;
import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.typing.TypingRun;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A Passage's Leaderboard, read through the HTTP boundary against a real
 * PostgreSQL.
 *
 * Every ranking here is of a Passage this class inserted for itself, and the
 * reason is isolation rather than convenience. The suite shares one database
 * and one application across every test class, and nothing rolls back — so a
 * board over a catalogue Passage would carry whatever Runs the Challenge and
 * profile suites happened to play against it, and an assertion about who is in
 * the top three would pass or fail on test ordering. A Passage nobody else can
 * be dealt is the only way to state what is on a board and mean it.
 *
 * The Users are real, created through the endpoint a visitor arrives at. Their
 * Runs are written directly, which is the one thing here that a player does not
 * do — because a Run cannot be aimed. Which Passage a player is handed is the
 * server's random choice (ADR-0003, and deliberately so), and a test that asked
 * for Quotes until it was dealt this one would be a loop with a probability
 * attached. What a ranking is <em>about</em> is the ordering of stored WPMs, and
 * writing the WPMs down is how a tie gets to be an exact tie rather than two
 * durations that came out close. That the recording path produces rows this
 * board can see is proved separately, by
 * {@link #aRunActuallyPlayedTurnsUpOnThatPassagesBoard()}, which plays one for
 * real.
 *
 * The Passage is taken back out of the catalogue when the class finishes, and
 * that is not tidiness. While it is in there, any suite that asks for a Prose
 * Challenge can be dealt it — and it is eight hundred characters, so a test that
 * transcribes whatever it was handed in thirty seconds claims three hundred
 * words per minute and is correctly refused as impossible (ADR-0003). The
 * catalogue is shared state, and the only safe way to add to it is to put it
 * back.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PassageLeaderboardEndpointTest extends AbstractIntegrationTest {

    /**
     * The Passage every board in this class ranks.
     *
     * Long enough that the fastest Run below is a believable minute's typing —
     * 160 WPM is 800 correct characters — and unique to this class, which is
     * what keeps every other suite's Runs off these boards.
     */
    private static final String OWN_PASSAGE_TEXT = "The leaderboard suite types this and nothing else. "
            .repeat(16)
            .trim();

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    private UUID passageId;

    /**
     * A counter that keeps written Runs in the order they were written.
     *
     * Ties are ordered among themselves by who finished first, and the whole
     * point of a tie test is that the WPMs are identical — so the tiebreak is
     * the only thing deciding the order, and it has to be something this test
     * chose rather than however two inserts happened to land on the same
     * microsecond.
     */
    private int recorded;

    @BeforeEach
    void aPassageOfThisSuitesOwn() {
        recorded = 0;
        passageId = jdbc.queryForObject(
                """
                INSERT INTO passages (discipline, text, attribution)
                VALUES ('PROSE', ?, 'The leaderboard suite')
                ON CONFLICT (text) DO UPDATE SET attribution = excluded.attribution
                RETURNING id
                """,
                UUID.class,
                OWN_PASSAGE_TEXT);
        jdbc.update("DELETE FROM typing_runs WHERE passage_id = ?", passageId);
    }

    /**
     * Puts the catalogue back the way it was found.
     *
     * In dependency order, because a Passage that has been issued cannot simply
     * be deleted — the Issues and the Runs referencing it go first (V5 gives
     * neither a cascade, deliberately, so that deleting a Passage cannot quietly
     * rewrite what a recorded Run was a Run of).
     */
    @AfterAll
    void theCatalogueIsPutBack() {
        jdbc.update("DELETE FROM typing_runs WHERE passage_id = ?", passageId);
        jdbc.update("DELETE FROM issues WHERE passage_id = ?", passageId);
        jdbc.update("DELETE FROM passages WHERE id = ?", passageId);
    }

    @Test
    @DisplayName("only a User's best Run counts, so replaying a Passage does not fill the board")
    void onlyTheBestRunOfEachUserCounts() {
        Browser persistent = Browser.arrivingAt(http);
        typed(persistent, 90);
        typed(persistent, 130);
        typed(persistent, 110);
        fourOthersAtAround(60);

        Leaderboard board = boardAsSeenBy(persistent);

        // Three Runs, one row. Ranking Runs rather than Users is how one fast
        // typist with an afternoon to spare occupies the whole top ten.
        assertThat(board.entries())
                .filteredOn(entry -> entry.user().id().equals(persistent.user().id()))
                .singleElement()
                .satisfies(entry -> {
                    assertThat(entry.position()).isEqualTo(1);
                    // Their best, not their latest. A bad Run after a good one
                    // costs nobody their place.
                    assertThat(entry.wpm()).isEqualByComparingTo("130.0");
                });
    }

    @Test
    @DisplayName("tied Runs share a position, and the next one down skips it")
    void tiedRunsShareAPosition() {
        Browser fastest = Browser.arrivingAt(http);
        Browser tiedFirst = Browser.arrivingAt(http);
        Browser tiedSecond = Browser.arrivingAt(http);
        Browser slowest = Browser.arrivingAt(http);
        Browser alsoRan = Browser.arrivingAt(http);

        typed(fastest, 140);
        typed(tiedFirst, 120);
        typed(tiedSecond, 120);
        typed(slowest, 80);
        typed(alsoRan, 70);

        List<LeaderboardEntry> entries = boardAsSeenBy(fastest).entries();

        // Standard competition ranking: two Users on 120 are both second, and
        // the next reads fourth. Telling the slower of two tied players they
        // came third would be a ranking claiming somebody beat them.
        assertThat(entries).extracting(LeaderboardEntry::position).containsExactly(1, 2, 2, 4, 5);
        // Among the tied, the one who got there first is listed first — a
        // tiebreak for the order of the list only. Both rows still read 2.
        assertThat(entries)
                .extracting(entry -> entry.user().id())
                .containsExactly(
                        fastest.user().id(),
                        tiedFirst.user().id(),
                        tiedSecond.user().id(),
                        slowest.user().id(),
                        alsoRan.user().id());
    }

    @Test
    @DisplayName("the asker's own row comes back even from far below the published top")
    void theAskersOwnRowComesBackFromBelowTheTop() {
        Browser wayDown = Browser.arrivingAt(http);
        for (int i = 0; i < LeaderboardService.PUBLISHED + 1; i++) {
            typed(Browser.arrivingAt(http), 100 + i);
        }
        typed(wayDown, 40);

        Leaderboard board = boardAsSeenBy(wayDown);

        assertThat(board.participants()).isEqualTo(LeaderboardService.PUBLISHED + 2);
        assertThat(board.entries()).hasSize(LeaderboardService.PUBLISHED);
        assertThat(board.entries())
                .as("the asker is nowhere near the top, and the top is not padded to include them")
                .noneMatch(entry -> entry.user().id().equals(wayDown.user().id()));

        // Sent separately so a screen can pin it into view without paging down
        // to somewhere nobody wants to be shown by scrolling.
        assertThat(board.you()).isNotNull();
        assertThat(board.you().user().id()).isEqualTo(wayDown.user().id());
        assertThat(board.you().position()).isEqualTo(LeaderboardService.PUBLISHED + 2);
        assertThat(board.you().wpm()).isEqualByComparingTo("40.0");
    }

    @Test
    @DisplayName("the asker's own row is in the list as well when they are in the top")
    void theAskersOwnRowIsAlsoInTheListWhenTheyAreInTheTop() {
        Browser second = Browser.arrivingAt(http);
        typed(Browser.arrivingAt(http), 150);
        typed(second, 120);
        fourOthersAtAround(60);

        Leaderboard board = boardAsSeenBy(second);

        // Carried twice on purpose. A screen showing five rows of ten cannot
        // work out whether the sixth is the asker's, and making it try is how a
        // row goes missing.
        assertThat(board.you()).isNotNull();
        assertThat(board.you().position()).isEqualTo(2);
        assertThat(board.entries()).contains(board.you());
    }

    @Test
    @DisplayName("Unclaimed Users are ranked identically to Claimed ones, in the same list")
    void unclaimedUsersAreRankedAlongsideClaimedOnes() {
        Browser claimed = Browser.arrivingAt(http);
        Browser unclaimed = Browser.arrivingAt(http);
        jdbc.update(
                "UPDATE users SET credential_subject = ? WHERE id = ?",
                "leaderboard-suite|" + claimed.user().id(),
                claimed.user().id());

        typed(unclaimed, 130);
        typed(claimed, 100);
        fourOthersAtAround(50);

        Leaderboard board = boardAsSeenBy(unclaimed);

        // One list, ordered by WPM and by nothing else. An Unclaimed User is a
        // User in a state, not a lesser kind of person, and having played
        // without an account does not put anybody below somebody who has one
        // (ADR-0007).
        assertThat(board.entries()).element(0).satisfies(entry -> {
            assertThat(entry.user().id()).isEqualTo(unclaimed.user().id());
            assertThat(entry.user().claimed()).isFalse();
        });
        assertThat(board.entries()).element(1).satisfies(entry -> {
            assertThat(entry.user().id()).isEqualTo(claimed.user().id());
            assertThat(entry.user().claimed()).isTrue();
        });
        // Both rows carry a Handle, because a row nobody can be identified by
        // ranks nobody.
        assertThat(board.entries()).allSatisfy(entry -> assertThat(entry.user().handle())
                .isNotBlank());
    }

    @Test
    @DisplayName("the ranking is withheld until enough distinct Users have attempted the Passage")
    void theRankingIsWithheldUntilEnoughUsersHaveAttempted() {
        Browser asker = Browser.arrivingAt(http);
        typed(asker, 100);
        for (int i = 0; i < LeaderboardService.MINIMUM_PARTICIPANTS - 2; i++) {
            typed(Browser.arrivingAt(http), 90 - i);
        }

        Leaderboard tooFew = boardAsSeenBy(asker);

        // Nobody is shown a ranking of four. The caller is told what it is
        // waiting for rather than handed a blank space, so the fallback can say
        // so and offer the Discipline instead.
        assertThat(tooFew.participants()).isEqualTo(LeaderboardService.MINIMUM_PARTICIPANTS - 1);
        assertThat(tooFew.minimumParticipants()).isEqualTo(LeaderboardService.MINIMUM_PARTICIPANTS);
        assertThat(tooFew.entries()).isEmpty();
        // Their own row survives the threshold. It is a fact about their own
        // Run, not a claim about a population, and a player who has just typed
        // something is owed the number they earned.
        assertThat(tooFew.you()).isNotNull();
        assertThat(tooFew.you().wpm()).isEqualByComparingTo("100.0");

        typed(Browser.arrivingAt(http), 150);

        Leaderboard enough = boardAsSeenBy(asker);

        assertThat(enough.participants()).isEqualTo(LeaderboardService.MINIMUM_PARTICIPANTS);
        assertThat(enough.entries()).hasSize(LeaderboardService.MINIMUM_PARTICIPANTS);
        assertThat(enough.you().position()).isEqualTo(2);
    }

    @Test
    @DisplayName("a Passage nobody has typed has an empty board, not a missing one")
    void aPassageNobodyHasTypedHasAnEmptyBoard() {
        Browser browser = Browser.arrivingAt(http);

        Leaderboard board = boardAsSeenBy(browser);

        // 200 and empty. The Passage exists and has simply not been played, and
        // a not-found here would send a screen down its fault path over a
        // Challenge that is perfectly fine.
        assertThat(board.passageId()).isEqualTo(passageId);
        assertThat(board.discipline()).isEqualTo(Discipline.PROSE);
        assertThat(board.participants()).isZero();
        assertThat(board.entries()).isEmpty();
        // Null rather than a row of zeroes: they have not typed this, and a
        // pinned row reading 0 WPM would be a claim about their typing.
        assertThat(board.you()).isNull();
    }

    @Test
    @DisplayName("a browser that is nobody yet still sees the board, with no row of its own")
    void aBrowserThatIsNobodyStillSeesTheBoard() {
        Browser someoneElse = Browser.arrivingAt(http);
        typed(someoneElse, 120);
        fourOthersAtAround(70);

        ResponseEntity<Leaderboard> response =
                http.getForEntity("/api/passages/" + passageId + "/leaderboard", Leaderboard.class);

        // A ranking is public. It is the one thing a visitor can be shown before
        // they have played anything, and only the pinned row needs to know who
        // is asking.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().entries()).hasSize(LeaderboardService.MINIMUM_PARTICIPANTS);
        assertThat(response.getBody().you()).isNull();
    }

    @Test
    @DisplayName("there is no board for a Passage that does not exist")
    void thereIsNoBoardForAPassageThatDoesNotExist() {
        Browser browser = Browser.arrivingAt(http);

        ResponseEntity<String> response =
                browser.reads("/api/passages/" + UUID.randomUUID() + "/leaderboard", String.class);

        // Distinct from the empty board above, and the query is written to keep
        // them distinct: an unattempted Challenge and an imaginary one are
        // answers to different mistakes.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("the board is cacheable briefly, and keyed by the browser asking")
    void theBoardIsCacheableBrieflyAndKeyedByTheBrowser() {
        Browser browser = Browser.arrivingAt(http);
        typed(browser, 100);

        HttpHeaders headers = browser.reads("/api/passages/" + passageId + "/leaderboard", Leaderboard.class)
                .getHeaders();

        // Repeated views of a board cost one query rather than one each.
        assertThat(headers.getFirst(HttpHeaders.CACHE_CONTROL)).contains("max-age=30", "public");
        // And the payload carries the asker's own row, so a shared cache must
        // not hand one player's pinned row to the next. The Recognition Key is
        // the only cookie this site sets, which makes the cache key "this board,
        // for this browser".
        assertThat(headers.getFirst(HttpHeaders.VARY)).isEqualTo(HttpHeaders.COOKIE);
    }

    @Test
    @DisplayName("a Run actually played turns up on that Passage's board")
    void aRunActuallyPlayedTurnsUpOnThatPassagesBoard() {
        Browser browser = Browser.arrivingAt(http);

        // The one test here that does not aim its Passage, because it cannot:
        // this is the real path, and which Passage a player gets is the server's
        // choice. Whatever came back is what the board is read for.
        TypingRun run = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(30));

        Leaderboard board = read(browser, run.passageId());

        // Asserted on the asker's own row rather than on the top of the board,
        // because this Passage is one of the catalogue's and other suites play
        // against it too. What this pins down is that a Run recorded through
        // Verification is a Run this ranking can see — with the server's WPM,
        // not a number written here.
        assertThat(board.passageId()).isEqualTo(run.passageId());
        assertThat(board.discipline()).isEqualTo(Discipline.QUOTES);
        assertThat(board.you()).isNotNull();
        assertThat(board.you().user().id()).isEqualTo(browser.user().id());
        assertThat(board.you().wpm()).isEqualByComparingTo(run.wpm());
        assertThat(board.you().accuracy()).isEqualByComparingTo(run.accuracy());
    }

    /**
     * Records a Run of this User's on this suite's Passage, at exactly this WPM.
     *
     * The row is what a minute of typing at that speed looks like: WPM is
     * correct characters over five per minute, so 130 WPM over sixty seconds is
     * 650 correct characters, and typing them all correctly is 100% Accuracy.
     * Writing a self-consistent row rather than an arbitrary one matters because
     * every one of these columns has a CHECK behind it (V5), and a fixture that
     * satisfied the constraints without meaning anything would be a board built
     * on Runs nobody could have played.
     *
     * The Issue is written consumed, which is the state a Run leaves it in. An
     * unconsumed one would collide with the next on {@code
     * issues_one_live_per_user} — the partial index that stops a player holding
     * two Challenges at once.
     */
    private void typed(Browser browser, int wpm) {
        int correctCharacters = wpm * 5;
        UUID issueId = jdbc.queryForObject(
                """
                INSERT INTO issues (user_id, passage_id, expires_at, consumed_at)
                VALUES (?, ?, now() + interval '10 minutes', now())
                RETURNING id
                """,
                UUID.class,
                browser.user().id(),
                passageId);

        jdbc.update(
                """
                INSERT INTO typing_runs (
                    user_id, passage_id, issue_id,
                    keystrokes, correct_characters, elapsed_millis,
                    wpm, accuracy, completed_at)
                VALUES (?, ?, ?, ?, ?, 60000, ?, 100.0, now() + (? * interval '1 millisecond'))
                """,
                browser.user().id(),
                passageId,
                issueId,
                correctCharacters,
                correctCharacters,
                wpm,
                recorded++);
    }

    /**
     * Four more Users on the board, well below whoever the test is about.
     *
     * The threshold is five distinct Users, so most of these tests need a
     * population before they can assert anything about an ordering at all. The
     * speeds descend so that no two of them tie by accident and change the
     * positions the test is actually checking.
     */
    private void fourOthersAtAround(int wpm) {
        for (int i = 0; i < LeaderboardService.MINIMUM_PARTICIPANTS - 1; i++) {
            typed(Browser.arrivingAt(http), wpm - i);
        }
    }

    private Leaderboard boardAsSeenBy(Browser browser) {
        return read(browser, passageId);
    }

    private Leaderboard read(Browser browser, UUID passage) {
        ResponseEntity<Leaderboard> response =
                browser.reads("/api/passages/" + passage + "/leaderboard", Leaderboard.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).as("no Leaderboard came back").isNotNull();
        return response.getBody();
    }
}
