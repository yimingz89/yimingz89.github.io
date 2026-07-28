---
title: "The Multivariate Gaussian Distribution"
topic: "Algorithms for Inference"
summary: "Gaussian parameterizations, inference operations, and independence structure."
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

**Definition 17.2 (jointly Gaussian).** For a **nondegenerate** random vector,
the following four conditions are equivalent and define a jointly Gaussian
collection. Here $\operatorname{Cov}(\mathbf x)\succ0$.

1. **Affine construction.** For $\mathbf u\sim\mathcal N(\mathbf0,I_n)$,

   $$
   \mathbf x\overset{d}=A\mathbf u+\mathbf b,
   $$

   where $A\in\mathbb R^{n\times n}$ is invertible and
   $\mathbf b\in\mathbb R^n$.

2. **Linear projections.** For every $\mathbf a\neq\mathbf0$, the linear
   combination

   $$
   \mathbf a^\mathsf T\mathbf x
   $$

   is a scalar Gaussian with positive variance. The zero projection is treated
   as a degenerate Gaussian.

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
   $J=J^\mathsf T\succ0$ and potential vector $\mathbf h$, we define
   $\mathcal N^{-1}(J,\mathbf h):=\mathcal N(J^{-1}\mathbf h,J^{-1})$. Thus
   $\mathbf x\sim\mathcal N^{-1}(J,\mathbf h)$ has density

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
$\mathbf x\overset{d}=A\mathbf u+\mathbf b$, then for every
$\mathbf a\neq\mathbf0$,

$$
\mathbf a^\mathsf T\mathbf x
\overset{d}=
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
\mathbf x\overset{d}=A\mathbf u+\boldsymbol\mu.
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

## 17.3 Inference with Jointly Gaussian Variables

Partition a jointly Gaussian vector into
$\mathbf x_1\in\mathbb R^p$ and $\mathbf x_2\in\mathbb R^q$:

$$
\mathbf x
=
\begin{bmatrix}
\mathbf x_1\\
\mathbf x_2
\end{bmatrix},
\qquad
\boldsymbol\mu
=
\begin{bmatrix}
\boldsymbol\mu_1\\
\boldsymbol\mu_2
\end{bmatrix},
\qquad
\Sigma
=
\begin{bmatrix}
\Sigma_{11} & \Sigma_{12}\\
\Sigma_{21} & \Sigma_{22}
\end{bmatrix}.
$$

The same distribution in information form has

$$
\mathbf h
=
\begin{bmatrix}
\mathbf h_1\\
\mathbf h_2
\end{bmatrix},
\qquad
J
=
\begin{bmatrix}
J_{11} & J_{12}\\
J_{21} & J_{22}
\end{bmatrix},
\qquad
J=\Sigma^{-1},
\qquad
\mathbf h=J\boldsymbol\mu.
$$

### 17.3.1 Marginalization

**Claim 17.1 (Gaussian marginal).** Marginalizing either block preserves
Gaussianity. In covariance form, simply keep the relevant mean and covariance
blocks:

$$
\boxed{
\mathbf x_1\sim
\mathcal N(\boldsymbol\mu_1,\Sigma_{11})
}.
$$

In information form,

$$
\boxed{
\mathbf x_1\sim
\mathcal N^{-1}(J_{\mathrm m},\mathbf h_{\mathrm m})
},
$$

where

$$
J_{\mathrm m}
=
J_{11}-J_{12}J_{22}^{-1}J_{21},
\qquad
\mathbf h_{\mathrm m}
=
\mathbf h_1-J_{12}J_{22}^{-1}\mathbf h_2.
$$

$J_{\mathrm m}$ is the Schur complement of $J_{22}$ in $J$; equivalently,
$J_{\mathrm m}=\Sigma_{11}^{-1}$ and
$\mathbf h_{\mathrm m}=J_{\mathrm m}\boldsymbol\mu_1$.

<details class="proof-disclosure">
  <summary>Proof of Claim 17.1: marginalization</summary>
  <div class="proof-body" markdown="1">

**Covariance form.** Let
$P=\begin{bmatrix}I_p&0\end{bmatrix}$, so
$\mathbf x_1=P\mathbf x$. A linear image of a jointly Gaussian vector is
Gaussian, and

$$
\mathbb E[\mathbf x_1]
=
P\boldsymbol\mu
=
\boldsymbol\mu_1,
\qquad
\operatorname{Cov}(\mathbf x_1)
=
P\Sigma P^\mathsf T
=
\Sigma_{11}.
$$

Therefore
$\mathbf x_1\sim\mathcal N(\boldsymbol\mu_1,\Sigma_{11})$.

**Information form.** Integrate $\mathbf z_2$ out of the joint information
kernel:

$$
\begin{aligned}
p_{\mathbf x_1}(\mathbf z_1)
&\propto
\exp\!\left(
  -\frac12\mathbf z_1^\mathsf T J_{11}\mathbf z_1
  +\mathbf h_1^\mathsf T\mathbf z_1
\right)\\
&\quad{}\times
\int_{\mathbb R^q}
\exp\!\left[
  -\frac12\mathbf z_2^\mathsf T J_{22}\mathbf z_2
  +(\mathbf h_2-J_{21}\mathbf z_1)^\mathsf T\mathbf z_2
\right]
\,d\mathbf z_2.
\end{aligned}
$$

For $K\succ0$, completing the square gives

$$
\int
\exp\!\left(
  -\frac12\mathbf z^\mathsf T K\mathbf z
  +\mathbf g^\mathsf T\mathbf z
\right)
d\mathbf z
\propto
\exp\!\left(
  \frac12\mathbf g^\mathsf T K^{-1}\mathbf g
\right).
$$

Apply this with
$\mathbf g=\mathbf h_2-J_{21}\mathbf z_1$. After expanding the resulting
quadratic in $\mathbf z_1$,

$$
p_{\mathbf x_1}(\mathbf z_1)
\propto
\exp\!\left[
  -\frac12\mathbf z_1^\mathsf T
  \left(J_{11}-J_{12}J_{22}^{-1}J_{21}\right)
  \mathbf z_1
  +
  \left(\mathbf h_1-J_{12}J_{22}^{-1}\mathbf h_2\right)^\mathsf T
  \mathbf z_1
\right].
$$

This is
$\mathcal N^{-1}(J_{\mathrm m},\mathbf h_{\mathrm m})$. The Schur complement
$J_{\mathrm m}$ is positive definite because $J\succ0$. Comparing with the
covariance result also gives
$J_{\mathrm m}=\Sigma_{11}^{-1}$ and
$\mathbf h_{\mathrm m}=J_{\mathrm m}\boldsymbol\mu_1$.

  </div>
</details>

### 17.3.2 Conditioning

**Claim 17.2 (Gaussian conditional).** After observing
$\mathbf x_2=\mathbf c$,

$$
\boxed{
\mathbf x_1\mid\mathbf x_2=\mathbf c
\sim
\mathcal N(\boldsymbol\mu_{1\mid2},\Sigma_{1\mid2})
},
$$

where

$$
\boldsymbol\mu_{1\mid2}
=
\boldsymbol\mu_1
+\Sigma_{12}\Sigma_{22}^{-1}
(\mathbf c-\boldsymbol\mu_2),
$$

and

$$
\Sigma_{1\mid2}
=
\Sigma_{11}
-\Sigma_{12}\Sigma_{22}^{-1}\Sigma_{21}.
$$

In information form, the same result is especially short:

$$
\boxed{
\mathbf x_1\mid\mathbf x_2=\mathbf c
\sim
\mathcal N^{-1}
\!\left(
  J_{11},
  \mathbf h_1-J_{12}\mathbf c
\right)
}.
$$

Equivalently,
$\Sigma_{1\mid2}=J_{11}^{-1}$ and
$\boldsymbol\mu_{1\mid2}=J_{11}^{-1}(\mathbf h_1-J_{12}\mathbf c)$.
The conditional covariance does not depend on the observed value $\mathbf c$.

<details class="proof-disclosure">
  <summary>Proof of Claim 17.2: conditioning</summary>
  <div class="proof-body" markdown="1">

**Information form.** Fix $\mathbf x_2=\mathbf c$ in the joint information
kernel. Since $\Sigma_{22}\succ0$, this gives the standard continuous version
of the conditional density for every $\mathbf c\in\mathbb R^q$. Every term
independent of $\mathbf z_1$ is absorbed into the conditional normalizer,
leaving

$$
p(\mathbf z_1\mid\mathbf c)
\propto
\exp\!\left[
  -\frac12\mathbf z_1^\mathsf T J_{11}\mathbf z_1
  +(\mathbf h_1-J_{12}\mathbf c)^\mathsf T\mathbf z_1
\right].
$$

Therefore the conditional information matrix is $J_{11}$ and its potential
vector is $\mathbf h_1-J_{12}\mathbf c$.

**Covariance form.** Define

$$
K=\Sigma_{12}\Sigma_{22}^{-1},
\qquad
\mathbf r
=
\mathbf x_1-\boldsymbol\mu_1
-K(\mathbf x_2-\boldsymbol\mu_2).
$$

The pair $(\mathbf r,\mathbf x_2)$ is jointly Gaussian because it is a linear
transformation of $\mathbf x$. Its cross-covariance is

$$
\operatorname{Cov}(\mathbf r,\mathbf x_2)
=
\Sigma_{12}-K\Sigma_{22}
=
0.
$$

Jointly Gaussian, uncorrelated blocks are independent: their covariance-form
density has a block-diagonal covariance and factors. Also,

$$
\operatorname{Cov}(\mathbf r)
=
\Sigma_{11}
-\Sigma_{12}\Sigma_{22}^{-1}\Sigma_{21}
=
\Sigma_{1\mid2}.
$$

Since

$$
\mathbf x_1
=
\boldsymbol\mu_1
+K(\mathbf x_2-\boldsymbol\mu_2)
+\mathbf r,
$$

conditioning on $\mathbf x_2=\mathbf c$ fixes the first two terms while the
independent Gaussian residual keeps its original law. Hence

$$
\mathbf x_1\mid\mathbf x_2=\mathbf c
\sim
\mathcal N\!\left(
  \boldsymbol\mu_1
  +\Sigma_{12}\Sigma_{22}^{-1}
   (\mathbf c-\boldsymbol\mu_2),
  \,
  \Sigma_{11}
  -\Sigma_{12}\Sigma_{22}^{-1}\Sigma_{21}
\right).
$$

  </div>
</details>

**Memory aid.** Marginalization is a block read in covariance form;
conditioning is a block read plus a potential-vector update in information
form. The opposite representation requires a Schur complement.

## 17.4 Independence Structure in Gaussian Distributions

Continue with a nondegenerate Gaussian vector partitioned exhaustively into
three blocks:

$$
\mathbf x
=
\begin{bmatrix}
\mathbf x_1\\
\mathbf x_2\\
\mathbf x_3
\end{bmatrix},
\qquad
\boldsymbol\mu
=
\begin{bmatrix}
\boldsymbol\mu_1\\
\boldsymbol\mu_2\\
\boldsymbol\mu_3
\end{bmatrix},
\qquad
\mathbf h
=
\begin{bmatrix}
\mathbf h_1\\
\mathbf h_2\\
\mathbf h_3
\end{bmatrix}.
$$

Its covariance and full precision matrices are

$$
\Sigma
=
\begin{bmatrix}
\Sigma_{11} & \Sigma_{12} & \Sigma_{13}\\
\Sigma_{21} & \Sigma_{22} & \Sigma_{23}\\
\Sigma_{31} & \Sigma_{32} & \Sigma_{33}
\end{bmatrix},
$$

and

$$
J
=
\Sigma^{-1}
=
\begin{bmatrix}
J_{11} & J_{12} & J_{13}\\
J_{21} & J_{22} & J_{23}\\
J_{31} & J_{32} & J_{33}
\end{bmatrix},
\qquad
\mathbf h=J\boldsymbol\mu.
$$

Write
$\mathbf x_1\mathrel{\perp\mkern-10mu\perp}\mathbf x_2$ for marginal
independence, and
$\mathbf x_1\mathrel{\perp\mkern-10mu\perp}\mathbf x_2\mid\mathbf x_3$
for conditional independence given $\mathbf x_3$. A zero block below means a
zero matrix of the appropriate size.

### 17.4.1 Marginal Independence

**Theorem 17.1 (marginal independence).** For jointly Gaussian blocks,

$$
\boxed{
\mathbf x_1\mathrel{\perp\mkern-10mu\perp}\mathbf x_2
\quad\Longleftrightarrow\quad
\Sigma_{12}=0
}.
$$

**Intuition.** $\Sigma_{12}$ records their marginal cross-covariance. In a
Gaussian law, no higher-order dependence remains after that block vanishes, so
uncorrelated blocks are independent. This implication is special to Gaussian
distributions.

<details class="proof-disclosure">
  <summary>Proof of Theorem 17.1: marginal independence</summary>
  <div class="proof-body" markdown="1">

First marginalize $\mathbf x_3$. Then
$(\mathbf x_1,\mathbf x_2)$ is jointly Gaussian with covariance

$$
\begin{bmatrix}
\Sigma_{11} & \Sigma_{12}\\
\Sigma_{21} & \Sigma_{22}
\end{bmatrix}.
$$

**Independence implies zero covariance.** If $\mathbf x_1$ and $\mathbf x_2$
are independent, then

$$
\begin{aligned}
\Sigma_{12}
&=
\mathbb E\!\left[
  (\mathbf x_1-\boldsymbol\mu_1)
  (\mathbf x_2-\boldsymbol\mu_2)^\mathsf T
\right]\\
&=
\mathbb E[\mathbf x_1-\boldsymbol\mu_1]\,
\mathbb E[\mathbf x_2-\boldsymbol\mu_2]^\mathsf T
=0.
\end{aligned}
$$

**Zero covariance implies independence.** The characteristic function of the
marginal pair is

$$
\begin{aligned}
\varphi_{12}(\mathbf t_1,\mathbf t_2)
=
\exp\!\bigg(
&i\mathbf t_1^\mathsf T\boldsymbol\mu_1
+i\mathbf t_2^\mathsf T\boldsymbol\mu_2
-\frac12\mathbf t_1^\mathsf T\Sigma_{11}\mathbf t_1\\
&-\mathbf t_1^\mathsf T\Sigma_{12}\mathbf t_2
-\frac12\mathbf t_2^\mathsf T\Sigma_{22}\mathbf t_2
\bigg).
\end{aligned}
$$

When $\Sigma_{12}=0$, this factors as

$$
\varphi_{12}(\mathbf t_1,\mathbf t_2)
=
\varphi_1(\mathbf t_1)\varphi_2(\mathbf t_2).
$$

A joint characteristic function factors exactly when the corresponding random
vectors are independent.

  </div>
</details>

### 17.4.2 Conditional Independence

**Theorem 17.2 (conditional independence).** For the exhaustive three-block
partition above,

$$
\boxed{
\mathbf x_1\mathrel{\perp\mkern-10mu\perp}\mathbf x_2
\mid\mathbf x_3
\quad\Longleftrightarrow\quad
J_{12}=0
}.
$$

Here $J_{12}$ is a block of the **full** precision matrix, not the precision of
the marginal pair $(\mathbf x_1,\mathbf x_2)$.

Equivalently, the conditional cross-covariance vanishes:

$$
\Sigma_{12\mid3}
=
\Sigma_{12}
-\Sigma_{13}\Sigma_{33}^{-1}\Sigma_{32}
=0.
$$

**Intuition.** Once $\mathbf x_3$ is fixed, $J_{12}$ is the only quadratic
term coupling $\mathbf x_1$ and $\mathbf x_2$. If it vanishes, the conditional
density separates into one factor for each block.

<details class="proof-disclosure">
  <summary>Proof of Theorem 17.2: conditional independence</summary>
  <div class="proof-body" markdown="1">

Fix $\mathbf x_3=\mathbf c$. Since the Gaussian density is positive, the
standard conditional formula gives a continuous version for every
$\mathbf c$. Discarding terms constant in
$(\mathbf z_1,\mathbf z_2)$, the conditional log density is

$$
\begin{aligned}
\log p(\mathbf z_1,\mathbf z_2\mid\mathbf c)
={}&
\text{constant}
-\frac12\mathbf z_1^\mathsf T J_{11}\mathbf z_1
-\mathbf z_1^\mathsf T J_{12}\mathbf z_2\\
&-\frac12\mathbf z_2^\mathsf T J_{22}\mathbf z_2
+(\mathbf h_1-J_{13}\mathbf c)^\mathsf T\mathbf z_1\\
&+(\mathbf h_2-J_{23}\mathbf c)^\mathsf T\mathbf z_2.
\end{aligned}
$$

**If $J_{12}=0$.** The exponent is a sum of a
$\mathbf z_1$-only function and a $\mathbf z_2$-only function. The normalizer
also factors, so

$$
p(\mathbf z_1,\mathbf z_2\mid\mathbf c)
=
p(\mathbf z_1\mid\mathbf c)\,
p(\mathbf z_2\mid\mathbf c).
$$

Thus $\mathbf x_1$ and $\mathbf x_2$ are conditionally independent given
$\mathbf x_3$.

**Only if.** Conditional independence makes the log density a sum of separate
$\mathbf z_1$- and $\mathbf z_2$-functions, so its mixed derivative is zero.
But the Gaussian log density above gives

$$
\frac{\partial}{\partial\mathbf z_2^\mathsf T}
\nabla_{\mathbf z_1}
\log p(\mathbf z_1,\mathbf z_2\mid\mathbf c)
=
-J_{12}.
$$

Therefore $J_{12}=0$.

Finally, §17.3.2 gives the conditional covariance of
$(\mathbf x_1,\mathbf x_2)$ given $\mathbf x_3$. Its off-diagonal block is

$$
\Sigma_{12\mid3}
=
\Sigma_{12}
-\Sigma_{13}\Sigma_{33}^{-1}\Sigma_{32}.
$$

The conditional distribution is Gaussian, so Theorem 17.1 also shows that
conditional independence is equivalent to $\Sigma_{12\mid3}=0$.

  </div>
</details>

**General form.** A zero block $J_{AB}$ in a Gaussian precision matrix means
$\mathbf x_A$ and $\mathbf x_B$ are conditionally independent given every
remaining coordinate.

**Memory aid.** Zeros in $\Sigma$ answer “independent?”; zeros in
$J=\Sigma^{-1}$ answer “independent after the rest is known?” The two sparsity
patterns generally differ.
