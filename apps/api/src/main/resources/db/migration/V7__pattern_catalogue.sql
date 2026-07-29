-- V7 — the opening Pattern catalogue.
--
-- Content ships as a migration for the same reason the Passages do: a
-- clone-and-run database is a playable one, and a Pattern Leaderboard is
-- meaningless if the row it ranks means a different puzzle in each environment.
--
-- Every Pattern here has a counterpart in the judge's compiled catalogue under
-- the same slug — `apps/judge/internal/pattern/catalogue/<slug>.json` — and the
-- two halves must agree: what a player reads is here, and the Hidden Tests that
-- decide the Verdict are there (ADR-0005). Adding a Pattern to one side alone
-- produces either a Pattern nothing can judge or a judge nobody can reach.
--
-- Every Pattern arrives inactive. Activation executes the reference solution
-- against every one of the Pattern's own tests and refuses unless all of them
-- pass, which is the only guarantee the tests are correct — see
-- PatternActivationService. Nothing here can set `activated_at`, and that is the
-- point: a migration cannot run Python.
--
-- The prompts are original descriptions of techniques. Techniques are not
-- copyrightable; problem statements are, and none are reproduced (ADR-0004).
--
-- Dollar quoting throughout: these are Python bodies full of quotes, colons and
-- apostrophes, and doubling apostrophes inside indentation-sensitive code is
-- where a typo hides.

INSERT INTO patterns (slug, name, family, seniority, prompt, scaffold, reference_solution) VALUES

('hash-map-seen-lookup',
 $n$Store what you've seen, look up what you need$n$,
 'HASH_MAP',
 'JUNIOR',
 $p$Scanning a list twice to find two things that go together costs you the length of the list, squared. The technique is to make one pass and remember, as you go, what you have already walked past -- and to remember it under the key you will later want to ask for.

Given a list of numbers and a target, return the indices of the two numbers that add to it, earliest pair first. Return an empty list when no pair does.

Ask yourself what you would want to look up at each number, and store that as you pass it.$p$,
 $s$def pair_sum(numbers, target):$s$,
 $r$    seen = {}
    for index, number in enumerate(numbers):
        if target - number in seen:
            return [seen[target - number], index]
        seen[number] = index
    return []$r$),

('sliding-window-longest-unique',
 $n$Grow the window until it breaks, then shrink from the left$n$,
 'SLIDING_WINDOW',
 'SENIOR',
 $p$A window over a sequence has two edges and only one of them moves at a time. The right edge advances greedily; when the window stops satisfying the property you care about, the left edge moves just far enough to restore it. Every element enters and leaves once, so the whole scan is linear however much the window jitters.

Given a string, return the length of the longest run of characters with no repeats in it.

The trap is the left edge: when you meet a repeat, it has to jump past the previous occurrence rather than step forward one at a time -- and never backwards, even when the previous occurrence is behind it.$p$,
 $s$def longest_unique(text):$s$,
 $r$    seen = {}
    longest = 0
    left = 0
    for right, character in enumerate(text):
        if character in seen and seen[character] >= left:
            left = seen[character] + 1
        seen[character] = right
        longest = max(longest, right - left + 1)
    return longest$r$);

-- The tests, mirroring the judge's catalogue file for each Pattern.
--
-- Example Tests are shown to the player before they start, so they know the
-- contract they are judged against. Hidden Tests are here only so activation can
-- notice the judge disagreeing about how many tests a Pattern has; no endpoint
-- reads them, and their failure is only ever reported as a count.

INSERT INTO pattern_tests (pattern_id, hidden, ordinal, name, call, expected)
SELECT p.id, t.hidden, t.ordinal, t.name, t.call, t.expected
FROM patterns p
JOIN (VALUES

    ('hash-map-seen-lookup', false, 1,
     'the pair is the first two numbers', 'pair_sum([2, 7, 11, 15], 9)', '[0, 1]'),
    ('hash-map-seen-lookup', false, 2,
     'no pair sums to the target', 'pair_sum([1, 2, 3], 100)', '[]'),
    ('hash-map-seen-lookup', true, 3,
     'the pair is not the first two numbers', 'pair_sum([3, 2, 4], 6)', '[1, 2]'),
    ('hash-map-seen-lookup', true, 4,
     'the same value twice', 'pair_sum([3, 3], 6)', '[0, 1]'),
    ('hash-map-seen-lookup', true, 5,
     'negative numbers', 'pair_sum([-1, -2, -3, -4], -6)', '[1, 3]'),
    ('hash-map-seen-lookup', true, 6,
     'the pair is at the end of a long input', 'pair_sum(list(range(1, 2001)), 3999)', '[1998, 1999]'),

    ('sliding-window-longest-unique', false, 1,
     'the window has to slide past a repeat', 'longest_unique(''abcabcbb'')', '3'),
    ('sliding-window-longest-unique', false, 2,
     'nothing to window over', 'longest_unique('''')', '0'),
    ('sliding-window-longest-unique', true, 3,
     'every character repeats', 'longest_unique(''bbbbb'')', '1'),
    ('sliding-window-longest-unique', true, 4,
     'the answer is not a prefix', 'longest_unique(''pwwkew'')', '3'),
    ('sliding-window-longest-unique', true, 5,
     'no character repeats at all', 'longest_unique(''abcdef'')', '6'),
    ('sliding-window-longest-unique', true, 6,
     'the left edge must jump forward, not step', 'longest_unique(''dvdf'')', '3')

) AS t (slug, hidden, ordinal, name, call, expected) ON t.slug = p.slug;
