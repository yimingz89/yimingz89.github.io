---
title: "2. Gaussian Graphical Models and Inference"
topic: "Algorithms for Inference"
summary: "Gaussian Markov processes, precision factorization, innovations, and message passing."
order: 2
---

[Post 1: The Multivariate Gaussian Distribution](/notes/algorithms-for-inference/multivariate-gaussian-distribution/)
developed Gaussian conditioning, marginalization, and independence in matrix
form. Here we add graph structure. For a Gaussian chain, the Markov
factorization is equivalent to an affine linear dynamical system. Eliminating
one node then turns a Schur complement into a local message.

## 2.1 Gaussian Markov Processes

A Gauss–Markov process is a Gaussian distribution whose graphical structure is
a chain. The same model can be read either as a factorized joint distribution
or as a recursive sampling rule.

**Definition 2.1 (Gauss–Markov process).** A jointly Gaussian sequence of
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
\mathrel{\perp\mkern-10mu\perp}
\mathbf x_{1:i-1}
\mid
\mathbf x_i.
$$

The factorization says what is conditionally independent. For generation and
computation, it is useful to expose the fresh randomness at each step.

**Definition 2.2 (affine linear dynamical system).** Let
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

Each input contributes genuinely new information. The following fact
formalizes that freshness and is the independence step that makes the
recursion Markov.

**Fact 2.1 (past states and future innovations).** In this system,

$$
(\mathbf x_1,\ldots,\mathbf x_i)
\mathrel{\perp\mkern-10mu\perp}
(\mathbf v_i,\ldots,\mathbf v_{N-1}),
\qquad
i=1,\ldots,N-1.
$$

The state history uses only the initial condition and innovations already seen;
future innovations have not entered the recursion. In particular,
$\mathbf x_{i+1}$ is independent of
$(\mathbf v_{i+1},\ldots,\mathbf v_{N-1})$.

<details class="proof-disclosure">
  <summary>Proof of Fact 2.1: past states and future innovations</summary>
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

This is the key independence needed in one direction of the next result. The
converse uses Gaussian conditioning to show that every one-step prediction
error can itself serve as a fresh innovation.

**Claim 2.1 (innovation representation).** A nondegenerate Gaussian sequence
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
  <summary>Proof of Claim 2.1: innovation representation</summary>
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
$\boldsymbol\varepsilon_i\mathrel{\perp\mkern-10mu\perp}\mathbf x_{1:i}$. Every
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

In information form, the same chain has a block-tridiagonal precision matrix:
only neighboring states have cross-blocks. The innovation representation
explains how the chain is generated; inference asks the complementary question:
how can we eliminate an unobserved variable while retaining its complete effect
on the variables that remain? The two-node calculation below is the atomic
elimination step.

## 2.2 Gaussian Elimination: The Two-Node Case

Consider two Gaussian blocks joined by one edge:
$\mathbf x_1\text{—}\mathbf x_2$. The entire message-passing idea is already
visible here:

$$
\boxed{
\begin{aligned}
\text{eliminate node 2}
&=
\text{integrate out }\mathbf x_2\\
&=
\text{send its effect to node 1}.
\end{aligned}
}
$$

Let $\mathbf x_1\in\mathbb R^p$ and $\mathbf x_2\in\mathbb R^q$, with

$$
\begin{bmatrix}
\mathbf x_1\\
\mathbf x_2
\end{bmatrix}
\sim
\mathcal N^{-1}(J,\mathbf h),
\qquad
J
=
\begin{bmatrix}
J_{11} & J_{12}\\
J_{21} & J_{22}
\end{bmatrix},
\qquad
\mathbf h
=
\begin{bmatrix}
\mathbf h_1\\
\mathbf h_2
\end{bmatrix},
\qquad
J=J^\mathsf T\succ0,
\quad
J_{21}=J_{12}^\mathsf T.
$$

Here
$\mathcal N^{-1}(J,\mathbf h):=\mathcal N(J^{-1}\mathbf h,J^{-1})$.

**Claim 2.2 (two-node Gaussian elimination).** Marginalizing
$\mathbf x_2$ gives

$$
\boxed{
\mathbf x_1
\sim
\mathcal N^{-1}(J_{\mathrm m},\mathbf h_{\mathrm m})
},
$$

where

$$
\boxed{
J_{\mathrm m}
=
J_{11}-J_{12}J_{22}^{-1}J_{21},
\qquad
\mathbf h_{\mathrm m}
=
\mathbf h_1-J_{12}J_{22}^{-1}\mathbf h_2.
}
$$

This is the usual information-form Schur complement. To turn the same algebra
into a local algorithm, factor the joint kernel and treat the eliminated
node's contribution as a message across its only edge.

### 2.2.1 Factorization and the Message

Split the joint density into two node potentials and one edge potential:

$$
\begin{aligned}
\phi_1(\mathbf x_1)
&=
\exp\left(
  -\frac12\mathbf x_1^\mathsf T J_{11}\mathbf x_1
  +\mathbf h_1^\mathsf T\mathbf x_1
\right),\\
\phi_2(\mathbf x_2)
&=
\exp\left(
  -\frac12\mathbf x_2^\mathsf T J_{22}\mathbf x_2
  +\mathbf h_2^\mathsf T\mathbf x_2
\right),\\
\psi_{12}(\mathbf x_1,\mathbf x_2)
&=
\exp\left(
  -\mathbf x_1^\mathsf T J_{12}\mathbf x_2
\right),
\end{aligned}
$$

so

$$
p(\mathbf x_1,\mathbf x_2)
\propto
\phi_1(\mathbf x_1)
\phi_2(\mathbf x_2)
\psi_{12}(\mathbf x_1,\mathbf x_2).
$$

Eliminating node $2$ produces the sum-product message

$$
m_{2\to1}(\mathbf x_1)
:=
\int
\phi_2(\mathbf x_2)
\psi_{12}(\mathbf x_1,\mathbf x_2)
\,d\mathbf x_2.
$$

The message has exponential-quadratic form

$$
m_{2\to1}(\mathbf x_1)
\propto
\exp\left(
  -\frac12\mathbf x_1^\mathsf T
  J_{2\to1}\mathbf x_1
  +\mathbf h_{2\to1}^\mathsf T\mathbf x_1
\right),
$$

with

$$
\boxed{
J_{2\to1}
=
-J_{12}J_{22}^{-1}J_{21},
\qquad
\mathbf h_{2\to1}
=
-J_{12}J_{22}^{-1}\mathbf h_2.
}
$$

The marginal at node $1$ is its local potential times the incoming message:

$$
p(\mathbf x_1)
\propto
\phi_1(\mathbf x_1)m_{2\to1}(\mathbf x_1).
$$

Multiplication adds canonical (natural) parameters:

$$
\boxed{
J_{\mathrm m}=J_{11}+J_{2\to1},
\qquad
\mathbf h_{\mathrm m}=\mathbf h_1+\mathbf h_{2\to1}.
}
$$

**Intuition.** Node $2$ packages its entire effect on node $1$ into one matrix
and one vector. The matrix updates the quadratic term; the vector updates the
linear term. This finite-dimensional closure is why Gaussian message passing
reduces to linear algebra.

The message is an unnormalized **potential**, not necessarily a probability
density: $J_{2\to1}\preceq0$. Only after combining it with $\phi_1$ do we obtain
the proper marginal precision $J_{\mathrm m}\succ0$. Message scale can be
discarded when computing normalized marginals or MAP estimates, but not when
computing the partition function or evidence.

<details class="proof-disclosure">
  <summary>Derivation of the two-node message and marginal</summary>
  <div class="proof-body" markdown="1">

Collect the terms involving $\mathbf x_2$:

$$
\begin{aligned}
m_{2\to1}(\mathbf x_1)
&=
\int
\exp\left[
  -\frac12\mathbf x_2^\mathsf T J_{22}\mathbf x_2
  +\mathbf h_2^\mathsf T\mathbf x_2
  -\mathbf x_1^\mathsf T J_{12}\mathbf x_2
\right]
\,d\mathbf x_2\\
&=
\int
\exp\left[
  -\frac12\mathbf x_2^\mathsf T J_{22}\mathbf x_2
  +(\mathbf h_2-J_{21}\mathbf x_1)^\mathsf T\mathbf x_2
\right]
\,d\mathbf x_2.
\end{aligned}
$$

Since $J\succ0$, its principal block $J_{22}\succ0$. For any $K\succ0$,

$$
\int
\exp\left(
  -\frac12\mathbf z^\mathsf T K\mathbf z
  +\mathbf g^\mathsf T\mathbf z
\right)
\,d\mathbf z
\propto
\exp\left(
  \frac12\mathbf g^\mathsf T K^{-1}\mathbf g
\right).
$$

Apply this with
$\mathbf g=\mathbf h_2-J_{21}\mathbf x_1$:

$$
\begin{aligned}
\log m_{2\to1}(\mathbf x_1)
={}&
\text{constant}
+\frac12
(\mathbf h_2-J_{21}\mathbf x_1)^\mathsf T
J_{22}^{-1}
(\mathbf h_2-J_{21}\mathbf x_1)\\
={}&
\text{constant}
-\mathbf x_1^\mathsf T
J_{12}J_{22}^{-1}\mathbf h_2
+\frac12\mathbf x_1^\mathsf T
J_{12}J_{22}^{-1}J_{21}
\mathbf x_1.
\end{aligned}
$$

Matching this with

$$
-\frac12\mathbf x_1^\mathsf T J_{2\to1}\mathbf x_1
+\mathbf h_{2\to1}^\mathsf T\mathbf x_1
$$

gives the displayed message parameters. Finally, multiplying by $\phi_1$
adds the local and message parameters:

$$
\begin{aligned}
J_{\mathrm m}
&=
J_{11}+J_{2\to1}
=
J_{11}-J_{12}J_{22}^{-1}J_{21},\\
\mathbf h_{\mathrm m}
&=
\mathbf h_1+\mathbf h_{2\to1}
=
\mathbf h_1-J_{12}J_{22}^{-1}\mathbf h_2.
\end{aligned}
$$

This is exactly the Schur-complement marginal in Claim 2.2.

  </div>
</details>

**Memory aid.**

$$
\boxed{
\begin{aligned}
\text{eliminate a Gaussian node}
&\Longrightarrow
\text{send a matrix and vector},\\
\text{multiply Gaussian potentials}
&\Longrightarrow
\text{add those parameters}.
\end{aligned}
}
$$

On a larger tree, a node sending to one neighbor combines its local potential
with messages from every other neighbor, includes the connecting edge
potential, and integrates out its own variable. The resulting matrix–vector
pair is the outgoing message. Gaussian message passing is repeated local Schur
complementation.

## 2.3 Gaussian Distribution Factorization

The two-node decomposition is not special. Any Gaussian in information form
separates into one potential for each node and one potential for each
interacting pair. This turns the sparsity pattern of the precision matrix into
a graph on which local inference can operate.

Stack the block variables and information vector as

$$
\mathbf x
=
\begin{bmatrix}
\mathbf x_1\\[-2pt]
\vdots\\[-2pt]
\mathbf x_N
\end{bmatrix},
\qquad
\mathbf h
=
\begin{bmatrix}
\mathbf h_1\\[-2pt]
\vdots\\[-2pt]
\mathbf h_N
\end{bmatrix},
$$

and partition the symmetric precision matrix $J\succ0$ into blocks
$J_{ij}$, so $J_{ji}=J_{ij}^{\mathsf T}$. Assume

$$
\mathbf x\sim\mathcal N^{-1}(J,\mathbf h).
$$

**Claim 2.3 (Gaussian pairwise factorization).** The joint density factors as

$$
\boxed{
p(\mathbf x_{1:N})
\propto
\prod_{i=1}^N\phi_i(\mathbf x_i)
\prod_{(i,j)\in\mathcal E}
\psi_{ij}(\mathbf x_i,\mathbf x_j),
}
$$

where

$$
\phi_i(\mathbf x_i)
=
\exp\left(
  -\frac12\mathbf x_i^\mathsf T J_{ii}\mathbf x_i
  +\mathbf h_i^\mathsf T\mathbf x_i
\right)
$$

and

$$
\psi_{ij}(\mathbf x_i,\mathbf x_j)
=
\exp\left(
  -\mathbf x_i^\mathsf T J_{ij}\mathbf x_j
\right).
$$

The associated undirected graph has

$$
\mathcal V=\{1,\ldots,N\},
\qquad
\mathcal E
=
\{(i,j):i<j,\ J_{ij}\ne0\}.
$$

Thus a nonzero off-diagonal block creates an edge. If $J_{ij}=0$, its edge
potential is identically one and can be omitted.

<details class="proof-disclosure">
  <summary>Derivation of the general Gaussian factorization</summary>
  <div class="proof-body" markdown="1">

Start from the information-form exponent:

$$
\log p(\mathbf x_{1:N})
=
\text{constant}
-\frac12
\sum_{i=1}^N\sum_{j=1}^N
\mathbf x_i^\mathsf T J_{ij}\mathbf x_j
+
\sum_{i=1}^N\mathbf h_i^\mathsf T\mathbf x_i.
$$

Separate the diagonal and off-diagonal terms:

$$
\begin{aligned}
\log p(\mathbf x_{1:N})
={}&
\text{constant}
+
\sum_{i=1}^N
\left(
  -\frac12\mathbf x_i^\mathsf T J_{ii}\mathbf x_i
  +\mathbf h_i^\mathsf T\mathbf x_i
\right)\\
&-\frac12
\sum_{i<j}
\left(
  \mathbf x_i^\mathsf T J_{ij}\mathbf x_j
  +\mathbf x_j^\mathsf T J_{ji}\mathbf x_i
\right).
\end{aligned}
$$

Because $J_{ji}=J_{ij}^\mathsf T$ and each cross term is a scalar,

$$
\mathbf x_j^\mathsf T J_{ji}\mathbf x_i
=
\mathbf x_i^\mathsf T J_{ij}\mathbf x_j.
$$

Therefore

$$
\log p(\mathbf x_{1:N})
=
\text{constant}
+
\sum_{i=1}^N
\left(
  -\frac12\mathbf x_i^\mathsf T J_{ii}\mathbf x_i
  +\mathbf h_i^\mathsf T\mathbf x_i
\right)
-
\sum_{i<j}
\mathbf x_i^\mathsf T J_{ij}\mathbf x_j.
$$

Exponentiating converts the sum into the claimed product. Terms with
$J_{ij}=0$ contribute the constant factor one, so only edges in $\mathcal E$
need to be retained.

  </div>
</details>

The factors are potentials, not necessarily normalized densities on their own.
The complete product is normalizable because $J\succ0$.

The graph is read from the **precision matrix**, not the covariance matrix. For
a nondegenerate joint Gaussian,

$$
J_{ij}=0
\quad\Longleftrightarrow\quad
\mathbf x_i
\mathrel{\perp\mkern-10mu\perp}
\mathbf x_j
\mid
\mathbf x_{\mathcal V\setminus\{i,j\}}.
$$

So missing edges encode conditional independence given every other node. This
is the structural bridge from a global Gaussian formula to a local algorithm:
message passing only needs the factors adjacent to each node.

**Memory aid.**

$$
\boxed{
J_{ii}\longrightarrow\text{node potential},
\qquad
J_{ij}\ne0\longrightarrow\text{edge potential},
\qquad
J_{ij}=0\longrightarrow\text{missing edge}.
}
$$
