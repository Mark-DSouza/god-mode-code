package dev.markdsouza.godmodecode.user;

import dev.markdsouza.godmodecode.integrity.IssueRepository;
import dev.markdsouza.godmodecode.pattern.SolveRunService;
import dev.markdsouza.godmodecode.typing.TypingRunService;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Becoming someone, and being recognised afterwards.
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository users;
    private final HandleGenerator handles;
    private final TypingRunService typingRuns;
    private final SolveRunService solveRuns;
    private final IssueRepository issues;

    UserService(
            UserRepository users,
            HandleGenerator handles,
            TypingRunService typingRuns,
            SolveRunService solveRuns,
            IssueRepository issues) {
        this.users = users;
        this.handles = handles;
        this.typingRuns = typingRuns;
        this.solveRuns = solveRuns;
        this.issues = issues;
    }

    /**
     * A newly created User and the key their browser must present to be
     * recognised as them.
     *
     * The raw key is returned exactly once, here. Nothing stores it, and no later
     * request can ask for it back — only its digest was written down.
     */
    public record Arrival(User user, String recognitionKey) {}

    /**
     * Creates an Unclaimed User: a Handle, no credentials, nothing asked of the
     * visitor.
     */
    public Arrival createUnclaimedUser() {
        String recognitionKey = RecognitionKey.issue();
        String hash = RecognitionKey.hash(recognitionKey);
        List<String> candidates = handles.candidates();

        for (String handle : candidates) {
            Optional<User> created = users.insertIfHandleFree(handle, hash);
            if (created.isPresent()) {
                if (!handle.equals(candidates.getFirst())) {
                    log.debug("Handle {} was taken; issued {} instead", candidates.getFirst(), handle);
                }
                return new Arrival(created.get(), recognitionKey);
            }
        }

        // Every suffix for this pair is spoken for. With twelve thousand pairs
        // this means either the site is far larger than it was designed for or
        // the generator has stopped varying, and both are worth an error rather
        // than a Handle nobody can read.
        throw new IllegalStateException("Exhausted every suffix for the Handle " + candidates.getFirst());
    }

    /** The User a browser presenting this key is, if the key is still one we issued. */
    public Optional<User> recognise(String recognitionKey) {
        return users.findByRecognitionKeyHash(RecognitionKey.hash(recognitionKey));
    }

    /**
     * What Claiming produced.
     *
     * {@code newRecognitionKey} is set only when this browser now has to be
     * recognised as a different row than before — a merge, where the row its old
     * key named is gone (ADR-0007). A first-time claim changes nothing about
     * which row the browser is recognised as, so the cookie it already holds
     * keeps working and nothing new is issued.
     */
    public sealed interface ClaimResult {
        record Claimed(User user, Optional<String> newRecognitionKey) implements ClaimResult {}

        record HandleTaken() implements ClaimResult {}
    }

    /**
     * Attaches credentials to the User this browser is, or — if that credential
     * already belongs to someone — merges this browser's Runs into that someone
     * and leaves this User behind (ADR-0007, ADR-0011).
     *
     * One transaction, because a merge is not safe to observe half-done: a Run
     * reattributed but a User not yet deleted would count twice in a Personal
     * Best computed in between.
     *
     * @param source the User this browser is recognised as, which must be
     *     Unclaimed for anything here to do — a browser signing in to the
     *     credential it already holds is simply told who it already is.
     * @param credentialSubject the federated subject the identity provider
     *     vouched for.
     * @param handle chosen on Claiming; used only when this credential has never
     *     Claimed a User before.
     */
    @Transactional
    public ClaimResult claim(User source, String credentialSubject, String handle) {
        if (source.claimed()) {
            return new ClaimResult.Claimed(source, Optional.empty());
        }

        Optional<User> target = users.findByCredentialSubject(credentialSubject);
        if (target.isPresent()) {
            User destination = target.get();
            // Reattributed before the source row is deleted: both Run tables'
            // User foreign keys cascade on delete, and a Run not yet moved would
            // be deleted along with the row it used to belong to. The Issue each
            // moved Run's issue_id still names has to follow for the same
            // reason — deleting the source User below cascades every Issue still
            // theirs, and a Run pointing at one of those would be left with a
            // dangling reference.
            typingRuns.reattributeUser(source.id(), destination.id());
            solveRuns.reattributeUser(source.id(), destination.id());
            issues.reattributeConsumedIssues(source.id(), destination.id());

            String newKey = RecognitionKey.issue();
            users.updateRecognitionKeyHash(destination.id(), RecognitionKey.hash(newKey));
            users.delete(source.id());

            return new ClaimResult.Claimed(destination, Optional.of(newKey));
        }

        return users.claim(source.id(), credentialSubject, handle)
                .<ClaimResult>map(claimed -> new ClaimResult.Claimed(claimed, Optional.empty()))
                .orElseGet(ClaimResult.HandleTaken::new);
    }
}
