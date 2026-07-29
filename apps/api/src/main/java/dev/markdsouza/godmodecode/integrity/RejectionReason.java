package dev.markdsouza.godmodecode.integrity;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Why a submitted Run was not recorded.
 *
 * One vocabulary for both kinds of Run. The reasons about the Issue are the
 * integrity model itself and apply to anything verified against one; the two
 * below them are about a Passage in particular, and a Solve Run simply never
 * produces them.
 *
 * Machine-readable and part of the contract, because the client's response
 * differs by reason: an expired Challenge means "here is a new one", a replay
 * means "you already have this result", and an implausible speed means "we do
 * not believe you". A single 422 with prose would leave the client guessing.
 *
 * There is deliberately no reason for "this Issue belongs to somebody else". A
 * caller who guesses another User's Issue id is told only that there is no such
 * Issue, which is all they are entitled to know.
 *
 * Each reason carries its own wording, so the sentence a player is shown cannot
 * drift out of step with the code the client branches on.
 */
@Schema(description = "Why a submitted Run was not recorded")
public enum RejectionReason {

    /** No Issue with that id was handed to this User. */
    NO_SUCH_ISSUE("No Challenge with that id was handed to you."),

    /** The Challenge was handed out too long ago to still be answerable. */
    ISSUE_EXPIRED("That Challenge was handed out too long ago. Ask for another."),

    /** A Run has already been verified against this Issue. Issues are single use. */
    ISSUE_ALREADY_USED("A Run has already been recorded against that Challenge."),

    /** The User asked for another Challenge, which abandoned this one. */
    ISSUE_SUPERSEDED("That Challenge was abandoned when you asked for another."),

    /** The typed text does not correspond to the Passage that was issued. */
    PASSAGE_MISMATCH("The typed text does not correspond to the Passage that was issued."),

    /** The reported duration cannot be reconciled with the recorded issue time. */
    IMPOSSIBLE_DURATION("The reported duration does not fit the time since the Challenge was issued."),

    /** Fewer keystrokes were reported than characters were typed. */
    IMPLAUSIBLE_KEYSTROKES("Fewer keystrokes were reported than characters were typed."),

    /** The resulting WPM is beyond what a human hand produces. */
    IMPLAUSIBLE_SPEED("That speed is beyond what a human hand produces.");

    private final String explanation;

    RejectionReason(String explanation) {
        this.explanation = explanation;
    }

    /**
     * The sentence a player is shown.
     *
     * Nothing here reveals which bound was crossed by how much — that would be
     * a tuning guide for the next attempt.
     */
    public String explanation() {
        return explanation;
    }
}
