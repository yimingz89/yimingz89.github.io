---
title: "Proving That 1/n Converges to Zero"
topic: "Algorithms for Inference"
summary: "A direct epsilon proof that the sequence 1/n tends to zero."
order: 1
---

Consider the sequence

$$
a_n=\frac{1}{n}.
$$

We will prove from the definition that

$$
\lim_{n\to\infty}\frac{1}{n}=0.
$$

## Proof

Let $\varepsilon>0$. We need to find an integer $N$ such that

$$
n\geq N
\quad\Longrightarrow\quad
\left|\frac{1}{n}-0\right|<\varepsilon.
$$

Choose any integer $N$ satisfying

$$
N>\frac{1}{\varepsilon}.
$$

Then, whenever $n\geq N$,

$$
\left|\frac{1}{n}-0\right|
=\frac{1}{n}
\leq\frac{1}{N}
<\varepsilon.
$$

Therefore, by the definition of convergence,

$$
\frac{1}{n}\longrightarrow 0.
$$

## Takeaway

An epsilon proof turns “eventually close” into a concrete threshold: here it is
enough to choose $N>1/\varepsilon$.
