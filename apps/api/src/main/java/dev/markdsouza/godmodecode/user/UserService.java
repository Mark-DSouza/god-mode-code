package dev.markdsouza.godmodecode.user;

import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Becoming someone, and being recognised afterwards.
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository users;
    private final HandleGenerator handles;

    UserService(UserRepository users, HandleGenerator handles) {
        this.users = users;
        this.handles = handles;
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
        String base = handles.generateBase();

        for (int attempt = 1; attempt <= HandleWords.MAX_SUFFIX; attempt++) {
            String handle = handles.forAttempt(base, attempt);
            Optional<User> created = users.insertIfHandleFree(handle, hash);
            if (created.isPresent()) {
                if (attempt > 1) {
                    log.debug("Handle {} was taken; issued {} instead", base, handle);
                }
                return new Arrival(created.get(), recognitionKey);
            }
        }

        // Every suffix for this pair is spoken for. With twelve thousand pairs
        // this means either the site is far larger than it was designed for or
        // the generator has stopped varying, and both are worth an error rather
        // than a Handle nobody can read.
        throw new IllegalStateException("Exhausted every suffix for the Handle " + base);
    }

    /** The User a browser presenting this key is, if the key is still one we issued. */
    public Optional<User> recognise(String recognitionKey) {
        return users.findByRecognitionKeyHash(RecognitionKey.hash(recognitionKey));
    }
}
