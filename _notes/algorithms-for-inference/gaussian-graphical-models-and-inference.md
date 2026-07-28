---
title: "Gaussian Graphical Models and Inference"
topic: "Algorithms for Inference"
summary: "Gaussian Markov processes, linear dynamical systems, and innovation representations."
order: 2
---

## 17.6 Gaussian Markov Processes

A Gauss–Markov process is a Gaussian distribution whose graphical structure is
a chain. The same model can be read either as a factorized joint distribution
or as a recursive sampling rule.

**Definition 17.3 (Gauss–Markov process).** A jointly Gaussian sequence of
fixed-dimensional states
$\mathbf x_{1:N}=(\mathbf x_1,\ldots,\mathbf x_N)$, with
$\operatorname{Cov}(\mathbf x_{1:N})\succ0$, is Gauss–Markov if

$$
p(\mathbf x_{1:N})
=
p(\mathbf x_1)
\prod_{i=1}^{N-1}
p(\mathbf x_{i+1}\mid\mathbf x_i).
$$

Equivalently,

$$
\mathbf x_{i+1}
\mathrel{\perp\!\!\!\perp}
\mathbf x_{1:i-1}
\mid
\mathbf x_i.
$$

**Definition 17.4 (affine linear dynamical system).** Let
$\mathbf x_1$ be Gaussian and let

$$
\mathbf v_i
\overset{\mathrm{iid}}{\sim}
\mathcal N(\mathbf0,I),
\qquad
i=1,\ldots,N-1,
$$

with $\mathbf x_1,\mathbf v_1,\ldots,\mathbf v_{N-1}$ mutually independent.
An affine linear dynamical system evolves as

$$
\mathbf x_{i+1}
=
\mathbf b_i+A_i\mathbf x_i+B_i\mathbf v_i.
$$

For centered states, $\mathbf b_i=0$, giving the usual linear form.

**Fact 17.1 (past states and future innovations).** In this system,

$$
(\mathbf x_1,\ldots,\mathbf x_i)
\mathrel{\perp\!\!\!\perp}
(\mathbf v_i,\ldots,\mathbf v_{N-1}),
\qquad
i=1,\ldots,N-1.
$$

The state history uses only the initial condition and innovations already seen;
future innovations have not entered the recursion. In particular,
$\mathbf x_{i+1}$ is independent of
$(\mathbf v_{i+1},\ldots,\mathbf v_{N-1})$.

<details class="proof-disclosure">
  <summary>Proof of Fact 17.1: past states and future innovations</summary>
  <div class="proof-body" markdown="1">

Iterating the recursion shows that, for some affine function $f_i$,

$$
\mathbf x_{1:i}
=
f_i(\mathbf x_1,\mathbf v_1,\ldots,\mathbf v_{i-1}).
$$

The vector
$(\mathbf x_1,\mathbf v_1,\ldots,\mathbf v_{i-1})$ is independent of
$(\mathbf v_i,\ldots,\mathbf v_{N-1})$. Any function of the first vector is
therefore independent of the second.

  </div>
</details>

**Claim 17.3 (innovation representation).** A nondegenerate Gaussian sequence
is Gauss–Markov if and only if it can be written as an affine linear dynamical
system of the form above, with
$\operatorname{Cov}(\mathbf x_1)\succ0$ and
$B_iB_i^\mathsf T\succ0$.

For a Gauss–Markov sequence, write

$$
\boldsymbol\mu_i=\mathbb E[\mathbf x_i],
\qquad
\Sigma_{ij}
=
\operatorname{Cov}(\mathbf x_i,\mathbf x_j).
$$

One valid representation uses

$$
A_i
=
\Sigma_{i+1,i}\Sigma_{ii}^{-1},
\qquad
\mathbf b_i
=
\boldsymbol\mu_{i+1}-A_i\boldsymbol\mu_i,
$$

and

$$
Q_i
=
\Sigma_{i+1,i+1}
-\Sigma_{i+1,i}\Sigma_{ii}^{-1}\Sigma_{i,i+1},
\qquad
B_iB_i^\mathsf T=Q_i.
$$

Thus

$$
\mathbf x_{i+1}\mid\mathbf x_i
\sim
\mathcal N(
  \mathbf b_i+A_i\mathbf x_i,\,
  Q_i
).
$$

**Intuition.** Gaussian conditioning makes the transition mean affine and its
covariance independent of the observed state. The Markov factorization then
lets each transition be driven by a fresh independent Gaussian innovation.

<details class="proof-disclosure">
  <summary>Proof of Claim 17.3: innovation representation</summary>
  <div class="proof-body" markdown="1">

**Dynamical system $\Rightarrow$ Gauss–Markov.** Every state is an affine
function of the jointly Gaussian vector

$$
(\mathbf x_1,\mathbf v_1,\ldots,\mathbf v_{N-1}),
$$

so $(\mathbf x_1,\ldots,\mathbf x_N)$ is jointly Gaussian. Moreover,
$\mathbf v_i$ is independent of the entire state history
$(\mathbf x_1,\ldots,\mathbf x_i)$. The next state depends on this history only
through $\mathbf x_i$, together with the fresh innovation $\mathbf v_i$.
Therefore

$$
p(\mathbf x_{i+1}\mid\mathbf x_{1:i})
=
p(\mathbf x_{i+1}\mid\mathbf x_i),
$$

which is the Markov property.

**Gauss–Markov $\Rightarrow$ dynamical system.** Gaussian conditioning gives

$$
\mathbf x_{i+1}\mid\mathbf x_i=\mathbf z
\sim
\mathcal N(
  \mathbf b_i+A_i\mathbf z,\,
  Q_i
),
$$

with $A_i,\mathbf b_i,Q_i$ as displayed above. Define the residual innovation

$$
\boldsymbol\varepsilon_i
=
\mathbf x_{i+1}
-\mathbf b_i
-A_i\mathbf x_i.
$$

The Markov property lets us replace conditioning on the whole past by
conditioning only on $\mathbf x_i$. Therefore

$$
\boldsymbol\varepsilon_i
\mid
\mathbf x_{1:i}
\sim
\mathcal N(\mathbf0,Q_i).
$$

This conditional law does not depend on $\mathbf x_{1:i}$, so
$\boldsymbol\varepsilon_i\mathrel{\perp\!\!\!\perp}\mathbf x_{1:i}$. Every
earlier innovation is a function of $\mathbf x_{1:i}$; hence
$\boldsymbol\varepsilon_i$ is independent of
$(\mathbf x_1,\boldsymbol\varepsilon_1,\ldots,
\boldsymbol\varepsilon_{i-1})$. Inductively, the innovations are mutually
independent and independent of $\mathbf x_1$.

Because $Q_i\succ0$, take an invertible square root
$B_iB_i^\mathsf T=Q_i$ and set

$$
\mathbf v_i=B_i^{-1}\boldsymbol\varepsilon_i.
$$

Then the $\mathbf v_i$ are independent standard Gaussians and, for the original
states themselves,

$$
\mathbf x_{i+1}
=
\mathbf b_i+A_i\mathbf x_i+B_i\mathbf v_i.
$$

  </div>
</details>

**Memory aid.** Gaussianity makes the one-step predictor affine; the Markov
property makes each prediction error independent of the entire past.
