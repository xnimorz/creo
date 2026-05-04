# 0.2.6

1. Cache first mount render props for primitives
2. Fix re-bounding event to primitives
3. Fix old children slice handling to avoid incorrect data duplicity
4. Support chainable state & store
5. Improve child placement lookup performance from O(N) to O(1)
6. Improve "live-DOM" value handling: value, mute, checked
7. Make stores to use publicly visible symbol Symbol.for("creo.store")
8. 