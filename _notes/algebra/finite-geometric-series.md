---
title: "The Finite Geometric Series"
topic: "Algebra"
summary: "A short derivation of the formula for a finite geometric sum."
order: 1
---

A finite geometric series has the form

$$
S_n = 1+r+r^2+\cdots+r^n.
$$

## Proposition

If $r\neq 1$, then

$$
S_n=\frac{1-r^{n+1}}{1-r}.
$$

## Derivation

Multiply the series by $r$:

$$
rS_n=r+r^2+\cdots+r^{n+1}.
$$

Subtracting this equation from the original one causes all the middle terms to
cancel:

$$
S_n-rS_n=1-r^{n+1}.
$$

Thus

$$
(1-r)S_n=1-r^{n+1},
$$

and since $r\neq 1$,

$$
S_n=\frac{1-r^{n+1}}{1-r}.
$$

For example,

$$
1+2+2^2+2^3+2^4
=\frac{1-2^5}{1-2}
=31.
$$

## Takeaway

Multiplying by the common ratio shifts a geometric series by one term, making
subtraction collapse the whole sum.
