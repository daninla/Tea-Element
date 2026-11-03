# 0007 — Catalog state follows navigation

Status: accepted for the reported search/navigation regression.

The shared header remains mounted across Next.js routes. Its previous local query could survive a
search → product → all-tea navigation, so opening the search again and clicking all results searched
for the previous product. Header search now remounts on pathname/query-string changes and initializes
its text only from the current catalog URL. Back/forward restores the URL query; an unfiltered URL or
product page has no stale query. Debounce loading hides previous-query results immediately, including
when clearing the field. Search submissions trim input, omit blank queries and use router navigation.
The all-results label names the active query explicitly.

Uncontrolled filter inputs/selects also retained dirty values when React reused a form across URL
changes. Key the form by its applied canonical catalog URL; reset links additionally call native reset
so unapplied edits clear even when the destination equals the current address. GET filter submissions
and server-authoritative search/filter/sort/pagination semantics remain unchanged.

Add jest-environment-jsdom as a web-only development dependency. Real React DOM regression tests
exercise persistent layout navigation, URL restoration, stale debounce results, form resets and selects.
These cases failed before the fix; pure query serialization tests could not catch DOM state retention.
No production dependency or schema/event change is required.
