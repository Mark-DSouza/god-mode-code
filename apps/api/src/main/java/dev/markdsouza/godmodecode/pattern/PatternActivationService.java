package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.judge.JudgeClient;
import dev.markdsouza.godmodecode.judge.JudgeUnavailableException;
import dev.markdsouza.godmodecode.judge.Judging;
import dev.markdsouza.godmodecode.judge.SubmittedSource;
import dev.markdsouza.godmodecode.judge.UnknownPatternException;
import dev.markdsouza.godmodecode.judge.Verdict;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The gate a Pattern has to pass before anybody can be given it.
 *
 * <h2>Why this exists</h2>
 *
 * A Solve Run is judged by executing Hidden Tests (ADR-0004), and nobody sees
 * those tests — not the player, who is only told a count, and not the person who
 * wrote them, once the migration has shipped. If one of them is wrong, every
 * honest solution fails and the only way to find out is to be the player it
 * happened to. Executing the reference solution against every one of the
 * Pattern's own tests is the one check that catches that, and its absence is
 * what made the superseded design unworkable.
 *
 * <h2>What is actually checked</h2>
 *
 * Two things, and the second is easy to miss. The Verdict has to be Passed —
 * the reference solution really does satisfy the tests. And the number of tests
 * the judge ran has to be the number this Pattern has, because the judge's
 * catalogue is compiled into its binary and deployed separately from the
 * database (ADR-0005). A judge running an older copy of a Pattern would answer
 * Passed against two tests when the curator wrote six, and that Verdict is true
 * and useless.
 *
 * <h2>Why it is not automatic</h2>
 *
 * Activation is asked for, not done at startup. Booting the backend must not
 * depend on the judge: the judge is one Discipline's dependency on a routeless
 * subnet, and a boot that waited for it would let a judge outage take Quotes and
 * Prose down with it (ADR-0005).
 */
@Service
public class PatternActivationService {

    private static final Logger log = LoggerFactory.getLogger(PatternActivationService.class);

    private final PatternRepository patterns;
    private final JudgeClient judge;

    PatternActivationService(PatternRepository patterns, JudgeClient judge) {
        this.patterns = patterns;
        this.judge = judge;
    }

    /**
     * Runs the gate over every Pattern that has not passed it.
     *
     * Bulk because that is the actual act: a content migration ships several
     * Patterns and they all need checking. It costs one judging per inactive
     * Pattern and nothing at all once they are all through, which is what keeps
     * a route anybody can call from being a way to keep the judge busy.
     */
    public List<PatternActivation> activateWhatIsPending() {
        return patterns.awaitingActivation().stream().map(this::gate).toList();
    }

    private PatternActivation gate(PatternRepository.Candidate candidate) {
        // Assembled exactly as a player's submission will be, because that is
        // the thing being proved: not that the reference solution is correct
        // Python, but that the program the judge actually receives passes.
        String source = SubmittedProgram.assemble(candidate.scaffold(), candidate.referenceSolution());

        Judging judged;
        try {
            judged = judge.judge(new SubmittedSource(candidate.slug(), source));
        } catch (UnknownPatternException e) {
            return PatternActivation.refused(
                    candidate.slug(),
                    "The judge has no Pattern with this slug. The catalogues have skewed: this Pattern "
                            + "is in the database and not in the judge's binary.");
        } catch (JudgeUnavailableException e) {
            return PatternActivation.refused(
                    candidate.slug(), "The judge could not be asked (" + e.reason().name().toLowerCase() + ").");
        }

        if (judged.verdict() != Verdict.PASSED) {
            log.warn(
                    "Refused to activate patternSlug={} verdict={} tests={}/{}",
                    candidate.slug(),
                    judged.verdict().wireName(),
                    judged.testsPassed(),
                    judged.testsTotal());
            return PatternActivation.refused(
                    candidate.slug(),
                    "The reference solution did not pass: %s, %d of %d tests."
                            .formatted(judged.verdict().wireName(), judged.testsPassed(), judged.testsTotal()));
        }

        if (judged.testsTotal() != candidate.testCount()) {
            log.warn(
                    "Refused to activate patternSlug={} judgeTests={} catalogueTests={}",
                    candidate.slug(),
                    judged.testsTotal(),
                    candidate.testCount());
            return PatternActivation.refused(
                    candidate.slug(),
                    "The judge ran %d tests and this Pattern has %d. The catalogues have skewed, so a Passed "
                            .formatted(judged.testsTotal(), candidate.testCount())
                            + "Verdict does not mean what it says.");
        }

        patterns.activate(candidate.id());
        log.info("Activated patternSlug={} tests={}", candidate.slug(), judged.testsTotal());
        return PatternActivation.activated(candidate.slug(), judged.testsTotal());
    }
}
