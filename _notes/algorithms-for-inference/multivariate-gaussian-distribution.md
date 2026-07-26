---
title: "The Multivariate Gaussian Distribution"
topic: "Algorithms for Inference"
summary: "Four equivalent views of a jointly Gaussian random vector."
order: 1
---

## 17.1 Gaussian Random Variables

**Definition 17.1.** A scalar random variable $X$ is Gaussian if, for some
$\mu\in\mathbb R$ and $\sigma>0$, its density is

$$
p_X(x)
=
\frac{1}{\sqrt{2\pi\sigma^2}}
\exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right).
$$

Write $X\sim\mathcal N(\mu,\sigma^2)$. The case
$\mathcal N(0,1)$ is the **standard Gaussian**.

## 17.2 Jointly Gaussian Random Variables

Let $\mathbf x=(x_1,\ldots,x_n)^\mathsf T$. The most useful mental model is an
affine image of independent standard Gaussians; the other definitions describe
the same law from different viewpoints.

For the four-way equivalence below, assume the distribution is
**nondegenerate**: $\operatorname{Cov}(\mathbf x)\succ0$.

1. **Affine construction.** For $\mathbf u\sim\mathcal N(\mathbf0,I_n)$,

   $$
   \mathbf x\overset{d}=A\mathbf u+\mathbf b,
   $$

   where $A\in\mathbb R^{n\times n}$ is invertible and
   $\mathbf b\in\mathbb R^n$.

2. **Linear projections.** Every linear combination

   $$
   \mathbf a^\mathsf T\mathbf x
   $$

   is a scalar Gaussian. For $\mathbf a\neq\mathbf0$, its variance is positive.

3. **Covariance form.** For
   $\boldsymbol\mu=\mathbb E[\mathbf x]$ and
   $\Sigma=\operatorname{Cov}(\mathbf x)\succ0$,

   $$
   p_{\mathbf x}(\mathbf z)
   =
   \frac{1}{(2\pi)^{n/2}|\Sigma|^{1/2}}
   \exp\!\left[
     -\frac12
     (\mathbf z-\boldsymbol\mu)^\mathsf T
     \Sigma^{-1}
     (\mathbf z-\boldsymbol\mu)
   \right].
   $$

4. **Information form.** For an information matrix
   $J=J^\mathsf T\succ0$ and potential vector $\mathbf h$,

   $$
   p_{\mathbf x}(\mathbf z)
   =
   \frac1Z
   \exp\!\left(
     -\frac12\mathbf z^\mathsf T J\mathbf z
     +\mathbf h^\mathsf T\mathbf z
   \right),
   $$

   where

   $$
   Z
   =
   (2\pi)^{n/2}|J|^{-1/2}
   \exp\!\left(
     \frac12\mathbf h^\mathsf T J^{-1}\mathbf h
   \right).
   $$

The parameter maps are

$$
J=\Sigma^{-1},
\qquad
\mathbf h=J\boldsymbol\mu,
\qquad
\Sigma=J^{-1},
\qquad
\boldsymbol\mu=J^{-1}\mathbf h.
$$

<details class="proof-disclosure">
  <summary>Proof that definitions 1–4 are equivalent</summary>
  <div class="proof-body" markdown="1">

All random-vector equalities below are equalities in distribution.

**$1\Rightarrow2$.** If
$\mathbf x\overset d=A\mathbf u+\mathbf b$, then for every $\mathbf a$,

$$
\mathbf a^\mathsf T\mathbf x
\overset d=
(A^\mathsf T\mathbf a)^\mathsf T\mathbf u
+\mathbf a^\mathsf T\mathbf b
\sim
\mathcal N\!\left(
  \mathbf a^\mathsf T\mathbf b,\,
  \mathbf a^\mathsf TAA^\mathsf T\mathbf a
\right).
$$

If $\mathbf a\neq\mathbf0$, invertibility of $A$ makes this variance positive.

**$2\Rightarrow1$.** The coordinate projections have finite second moments, so
define

$$
\boldsymbol\mu=\mathbb E[\mathbf x],
\qquad
\Sigma=\operatorname{Cov}(\mathbf x).
$$

For every $\mathbf t\in\mathbb R^n$, the projection hypothesis gives

$$
\varphi_{\mathbf x}(\mathbf t)
=
\mathbb E\!\left[e^{i\mathbf t^\mathsf T\mathbf x}\right]
=
\exp\!\left(
  i\mathbf t^\mathsf T\boldsymbol\mu
  -\frac12\mathbf t^\mathsf T\Sigma\mathbf t
\right).
$$

Let $A=\Sigma^{1/2}$ and
$\mathbf u\sim\mathcal N(\mathbf0,I_n)$. Then
$A\mathbf u+\boldsymbol\mu$ has the same characteristic function as
$\mathbf x$. Uniqueness of characteristic functions gives

$$
\mathbf x\overset d=A\mathbf u+\boldsymbol\mu.
$$

Since $\Sigma\succ0$, $A$ is invertible.

**$1\Rightarrow3$.** Set
$\boldsymbol\mu=\mathbf b$ and $\Sigma=AA^\mathsf T$. The
change-of-variables formula gives

$$
\begin{aligned}
p_{\mathbf x}(\mathbf z)
&=
p_{\mathbf u}\!\left(A^{-1}(\mathbf z-\boldsymbol\mu)\right)
|\det A|^{-1}\\
&=
\frac{1}{(2\pi)^{n/2}|\Sigma|^{1/2}}
\exp\!\left[
  -\frac12
  (\mathbf z-\boldsymbol\mu)^\mathsf T
  \Sigma^{-1}
  (\mathbf z-\boldsymbol\mu)
\right],
\end{aligned}
$$

because $|\det A|=|\Sigma|^{1/2}$ and
$A^{-\mathsf T}A^{-1}=\Sigma^{-1}$.

**$3\Rightarrow1$.** Choose $A=\Sigma^{1/2}$. The vector
$A\mathbf u+\boldsymbol\mu$, with
$\mathbf u\sim\mathcal N(\mathbf0,I_n)$, has exactly the density in
definition 3, so it has the same law as $\mathbf x$.

**$3\Rightarrow4$.** Set

$$
J=\Sigma^{-1},
\qquad
\mathbf h=J\boldsymbol\mu.
$$

Expanding the covariance-form exponent gives

$$
-\frac12
(\mathbf z-\boldsymbol\mu)^\mathsf T
J
(\mathbf z-\boldsymbol\mu)
=
-\frac12\mathbf z^\mathsf T J\mathbf z
+\mathbf h^\mathsf T\mathbf z
-\frac12\mathbf h^\mathsf T J^{-1}\mathbf h.
$$

The last term is constant in $\mathbf z$ and yields the stated normalizer $Z$.

**$4\Rightarrow3$.** Set

$$
\Sigma=J^{-1},
\qquad
\boldsymbol\mu=J^{-1}\mathbf h.
$$

Completing the square,

$$
-\frac12\mathbf z^\mathsf T J\mathbf z
+\mathbf h^\mathsf T\mathbf z
=
-\frac12
(\mathbf z-\boldsymbol\mu)^\mathsf T
J
(\mathbf z-\boldsymbol\mu)
+\frac12\mathbf h^\mathsf T J^{-1}\mathbf h.
$$

Substitution of $Z$ now gives the covariance-form density in definition 3.

  </div>
</details>

For a singular Gaussian, $\Sigma\succeq0$ and definitions 1–2 still work with a
possibly noninvertible $A$. There is no density on all of $\mathbb R^n$, so
definitions 3–4 must instead be interpreted on the affine support.

## Quick Reference

- **Affine form:** sampling and geometric intuition.
- **Projection form:** linear measurements and closure under linear maps.
- **Covariance form:** moments and correlation structure.
- **Information form:** multiplying Gaussian factors and sparse inference.

The picture to remember is

$$
\text{spherical standard Gaussian}
\xrightarrow[\text{stretch / rotate}]{A}
\xrightarrow[\text{shift}]{\boldsymbol\mu}
\text{multivariate Gaussian},
\qquad
\Sigma=AA^\mathsf T.
$$
