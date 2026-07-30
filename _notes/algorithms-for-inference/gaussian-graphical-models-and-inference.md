---
title: "2. Gaussian Graphical Models and Inference"
topic: "Algorithms for Inference"
summary: "Gaussian Markov processes, precision factorization, and graph-aware Gaussian elimination on trees."
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

## 2.4 Gaussian Message Passing on Undirected Trees

The two-node calculation now becomes a local update rule. Assume the precision
graph $(\mathcal V,\mathcal E)$ from Section 2.3 is a tree. Removing an edge
$(i,j)$ then separates the graph into two components. The message $i\to j$
summarizes everything on the $i$ side as a function of $\mathbf x_j$.

Let $\mathcal N(i)$ denote the neighbors of node $i$. For either orientation of
an undirected edge, use
$\psi_{ij}(\mathbf x_i,\mathbf x_j)
=\psi_{ji}(\mathbf x_j,\mathbf x_i)$.
The sum–product message is

$$
m_{i\to j}(\mathbf x_j)
=
\int
\phi_i(\mathbf x_i)
\psi_{ij}(\mathbf x_i,\mathbf x_j)
\prod_{k\in\mathcal N(i)\setminus\{j\}}
m_{k\to i}(\mathbf x_i)
\,d\mathbf x_i.
$$

For a leaf sending toward the tree, the product is empty: it contributes only
its local and edge potentials.

Suppose each incoming message has canonical form

$$
m_{k\to i}(\mathbf x_i)
\propto
\exp\left(
  -\frac12\mathbf x_i^\mathsf T
  J_{k\to i}\mathbf x_i
  +\mathbf h_{k\to i}^\mathsf T\mathbf x_i
\right).
$$

Before eliminating $\mathbf x_i$, collect its local parameters and every
incoming message except the one from the recipient:

$$
\boxed{
\begin{aligned}
\bar J_{i\setminus j}
&=
J_{ii}
+
\sum_{k\in\mathcal N(i)\setminus\{j\}}
J_{k\to i},\\
\bar{\mathbf h}_{i\setminus j}
&=
\mathbf h_i
+
\sum_{k\in\mathcal N(i)\setminus\{j\}}
\mathbf h_{k\to i}.
\end{aligned}
}
$$

These are the **cavity parameters** at $i$: the information available at
$i$ when the branch through $j$ is left out.

**Claim 2.4 (Gaussian tree-message update).** The outgoing message remains an
exponential-quadratic potential,

$$
m_{i\to j}(\mathbf x_j)
\propto
\exp\left(
  -\frac12\mathbf x_j^\mathsf T
  J_{i\to j}\mathbf x_j
  +\mathbf h_{i\to j}^\mathsf T\mathbf x_j
\right),
$$

with

$$
\boxed{
\begin{aligned}
J_{i\to j}
&=
-J_{ji}
\bar J_{i\setminus j}^{-1}
J_{ij},\\
\mathbf h_{i\to j}
&=
-J_{ji}
\bar J_{i\setminus j}^{-1}
\bar{\mathbf h}_{i\setminus j}.
\end{aligned}
}
$$

Thus each message is just one matrix and one vector. It first adds all
information arriving from the other branches, then eliminates the sending
node through a local Schur complement.

<details class="proof-disclosure">
  <summary>Derivation of the Gaussian tree-message update</summary>
  <div class="proof-body" markdown="1">

After multiplying the local potential by the incoming messages, every term
involving $\mathbf x_i$ is

$$
-\frac12
\mathbf x_i^\mathsf T
\bar J_{i\setminus j}
\mathbf x_i
+
\bar{\mathbf h}_{i\setminus j}^\mathsf T\mathbf x_i
-
\mathbf x_i^\mathsf T J_{ij}\mathbf x_j.
$$

Therefore

$$
m_{i\to j}(\mathbf x_j)
\propto
\int
\exp\left[
  -\frac12
  \mathbf x_i^\mathsf T
  \bar J_{i\setminus j}
  \mathbf x_i
  +
  \left(
    \bar{\mathbf h}_{i\setminus j}
    -J_{ij}\mathbf x_j
  \right)^\mathsf T
  \mathbf x_i
\right]
\,d\mathbf x_i.
$$

Using the Gaussian integral

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
\right),
$$

we obtain, up to a constant independent of $\mathbf x_j$,

$$
\begin{aligned}
\log m_{i\to j}(\mathbf x_j)
={}&
-\mathbf x_j^\mathsf T
J_{ji}\bar J_{i\setminus j}^{-1}
\bar{\mathbf h}_{i\setminus j}\\
&+
\frac12
\mathbf x_j^\mathsf T
J_{ji}\bar J_{i\setminus j}^{-1}
J_{ij}\mathbf x_j
+
\text{constant}.
\end{aligned}
$$

Matching the quadratic and linear terms with the canonical message form gives
the displayed update.

  </div>
</details>

As in the two-node case, a message is a potential rather than a standalone
density: $J_{i\to j}\preceq0$. During a valid tree-elimination schedule,
$\bar J_{i\setminus j}\succ0$. In code, the displayed inverse should normally
be implemented as a linear solve.

Once node $i$ has received messages from **all** its neighbors, its marginal
parameters are

$$
\boxed{
\begin{aligned}
\widehat J_i
&=
J_{ii}
+
\sum_{k\in\mathcal N(i)}
J_{k\to i},\\
\widehat{\mathbf h}_i
&=
\mathbf h_i
+
\sum_{k\in\mathcal N(i)}
\mathbf h_{k\to i}.
\end{aligned}
}
$$

Hence

$$
\mathbf x_i
\sim
\mathcal N^{-1}
\left(
  \widehat J_i,\,
  \widehat{\mathbf h}_i
\right),
\qquad
\operatorname{Cov}(\mathbf x_i)
=
\widehat J_i^{-1},
\qquad
\mathbb E[\mathbf x_i]
=
\widehat J_i^{-1}\widehat{\mathbf h}_i.
$$

**Claim 2.5 (exactness on trees).** All node marginals are exact after one
inward pass and one outward pass:

1. Choose any node as the root.
2. **Collect:** send messages from the leaves toward the root. A node sends
   after receiving from every neighbor except its parent.
3. **Distribute:** send messages from the root back toward the leaves. A node
   sends after receiving from every neighbor except the child receiving the
   message.

After these two passes, both directed messages have been computed on every
edge, so every node can form $(\widehat J_i,\widehat{\mathbf h}_i)$. Messages
whose prerequisites are available can be computed in parallel.

<details class="proof-disclosure">
  <summary>Proof of Claim 2.5: why two passes are exact on a tree</summary>
  <div class="proof-body" markdown="1">

Remove an edge $(i,j)$, and let $\mathcal T_{i\to j}$ be the component
containing $i$. The exact contribution of that entire component to $j$ is

$$
\begin{aligned}
m_{i\to j}(\mathbf x_j)
\propto
\int&
\psi_{ij}(\mathbf x_i,\mathbf x_j)
\prod_{\ell\in\mathcal T_{i\to j}}
\phi_\ell(\mathbf x_\ell)\\
&\times
\prod_{(u,v)\in\mathcal E(\mathcal T_{i\to j})}
\psi_{uv}(\mathbf x_u,\mathbf x_v)
\,
d\mathbf x_{\mathcal T_{i\to j}}.
\end{aligned}
$$

For a leaf, this reduces directly to
$\int\phi_i(\mathbf x_i)\psi_{ij}(\mathbf x_i,\mathbf x_j)\,d\mathbf x_i$.
For an internal node, removing $i$ splits
$\mathcal T_{i\to j}\setminus\{i\}$ into the disjoint components rooted at
$k\in\mathcal N(i)\setminus\{j\}$. Integrating each component produces
$m_{k\to i}(\mathbf x_i)$, leaving exactly the recursive message update above.
Induction from the leaves therefore proves that every collected or distributed
message integrates out its whole side of the edge exactly.

Finally, deleting node $i$ separates the tree into the components rooted at
its neighbors. Multiplying $\phi_i$ by all incoming messages integrates out
every other node, so the resulting normalized belief is the exact marginal
$p(\mathbf x_i)$.

  </div>
</details>

Trees matter because no branch is counted twice. On a graph with cycles, the
same equations define **loopy Gaussian belief propagation**, whose convergence
and exactness require additional conditions.

**Memory aid.**

$$
\boxed{
\begin{aligned}
\text{local parameters}+\text{incoming messages}
&\longrightarrow
\text{cavity parameters},\\
\text{eliminate through one edge}
&\longrightarrow
\text{outgoing message},\\
\text{local parameters}+\text{all incoming messages}
&\longrightarrow
\text{exact node marginal}.
\end{aligned}
}
$$

## 2.5 Computational Complexity and Gaussian Elimination

Assume a tree with $N$ nodes, each state has dimension $d$, and the local
$d\times d$ matrices are dense. The important distinction is between the size
of a **local** solve, $d$, and the size of the **global** system, $Nd$.

**TL;DR.** Tree Gaussian BP computes every node marginal in $O(Nd^3)$ total,
versus $O(N^3d^3)$ for a dense global solve, because each local elimination is
cached and reused.

### 2.5.1 Runtime on a tree

A tree has $N-1$ edges and therefore $2(N-1)$ directed messages. For one
message $i\to j$, write

$$
K=\bar J_{i\setminus j},
\qquad
\mathbf g=\bar{\mathbf h}_{i\setminus j}.
$$

The work is:

1. **Collect the cavity parameters.** Adding dense $d\times d$ message
   matrices costs $O(d^2)$ per addition; adding their vectors costs $O(d)$.
   With cached node totals, aggregation over the whole tree costs
   $O(Nd^2)$.
2. **Factor the cavity precision.** A dense Cholesky factorization of
   $K$ costs $O(d^3)$.
3. **Compute both outgoing parameters.** Reuse that factorization to solve
   $KX=J_{ij}$ and $K\mathbf y=\mathbf g$, then form

   $$
   J_{i\to j}=-J_{ji}X,
   \qquad
   \mathbf h_{i\to j}=-J_{ji}\mathbf y.
   $$

   The matrix right-hand side and matrix product keep the total at
   $O(d^3)$ per message; the information-vector solve is only $O(d^2)$.

Thus all directed messages require

$$
\boxed{
2(N-1)\times O(d^3)=O(Nd^3).
}
$$

The same factorization is used for both $J_{i\to j}$ and
$\mathbf h_{i\to j}$; there is no second inverse. In practice, we solve the
linear systems rather than forming $K^{-1}$ explicitly.

Once the messages are available:

- Forming every
  $(\widehat J_i,\widehat{\mathbf h}_i)$ by adding incoming messages costs
  $O(Nd^2)$ in total.
- Computing each marginal mean directly from its completed
  $(\widehat J_i,\widehat{\mathbf h}_i)$ costs $O(Nd^3)$ total. If only the
  global mean is needed, cached elimination factors permit one root solve
  followed by $O(Nd^2)$ back-substitution; the preceding elimination work
  remains $O(Nd^3)$.
- Explicitly recovering every marginal covariance
  $\widehat J_i^{-1}$ also costs $O(Nd^3)$ total. If both means and
  covariances are needed, the same local factorizations can be reused.

Therefore the complete computation of all tree marginals is

$$
\boxed{
O(Nd^3)\ \text{work}.
}
$$

Storing the $O(N)$ directed matrix–vector messages costs $O(Nd^2)$.

This is a total-work statement. With parallel updates, the number of sequential
rounds is $O(\operatorname{diam}(\mathcal T))$: $O(N)$ for a chain and
$O(\log N)$ for a balanced tree. The corresponding arithmetic on the critical
path is $O(\operatorname{diam}(\mathcal T)d^3)$.

### 2.5.2 Comparison with a naive dense solve

Stacking every state produces a global information matrix of dimension
$Nd\times Nd$. If its sparsity is ignored, classical dense factorization or
matrix inversion costs

$$
\boxed{
O\!\left((Nd)^3\right)
=
O(N^3d^3),
}
$$

with $O((Nd)^2)=O(N^2d^2)$ storage. If only the mean is required, explicitly
forming the inverse is unnecessary, but the dense factorization still has
$O(N^3d^3)$ cost.

Tree BP replaces one global $Nd\times Nd$ problem with $O(N)$ local
$d\times d$ problems. The gain comes from sparsity and reuse, not from a new
matrix identity.

### 2.5.3 Gaussian BP is graph-aware Gaussian elimination

The covariance and information forms satisfy

$$
J=\Lambda^{-1},
\qquad
\mathbf h=J\boldsymbol\mu.
$$

Therefore computing the mean is exactly the linear-system problem

$$
J\boldsymbol\mu=\mathbf h.
$$

**Claim 2.6 (BP message as block elimination).** Let
$K=\bar J_{i\setminus j}$ and
$\mathbf g=\bar{\mathbf h}_{i\setminus j}$. Eliminating node $i$ from the
linear system updates node $j$ by

$$
\boxed{
\Delta J_j
=
-J_{ji}K^{-1}J_{ij}
=
J_{i\to j},
\qquad
\Delta\mathbf h_j
=
-J_{ji}K^{-1}\mathbf g
=
\mathbf h_{i\to j}.
}
$$

These are exactly the Gaussian BP message parameters. A message is the Schur
complement contribution left behind when a node—or an already summarized
subtree—is eliminated.

<details class="proof-disclosure">
  <summary>Derivation: one BP message is one block-elimination step</summary>
  <div class="proof-body" markdown="1">

After all other branches at $i$ have been summarized into $(K,\mathbf g)$,
the relevant block equations are

$$
\begin{bmatrix}
K & J_{ij}\\
J_{ji} & J_{jj}
\end{bmatrix}
\begin{bmatrix}
\boldsymbol\mu_i\\
\boldsymbol\mu_j
\end{bmatrix}
=
\begin{bmatrix}
\mathbf g\\
\mathbf h_j
\end{bmatrix}.
$$

The first row gives

$$
\boldsymbol\mu_i
=
K^{-1}
\left(
  \mathbf g-J_{ij}\boldsymbol\mu_j
\right).
$$

Substitute this into the second row:

$$
\left(
  J_{jj}
  -J_{ji}K^{-1}J_{ij}
\right)
\boldsymbol\mu_j
=
\mathbf h_j
-J_{ji}K^{-1}\mathbf g.
$$

Equivalently,

$$
\left(
  J_{jj}+J_{i\to j}
\right)
\boldsymbol\mu_j
=
\mathbf h_j+\mathbf h_{i\to j}.
$$

This is precisely what multiplying node $j$'s local potential by the incoming
message does in information form.

  </div>
</details>

The ordering is what preserves the computational advantage:

- **Leaf-first elimination:** a leaf has only one remaining neighbor, so
  eliminating it creates no new edge.
- **Eliminating an interior node too early:** all its remaining neighbors
  become mutually coupled. These new nonzero blocks are **fill-in** and make
  later eliminations more expensive.
- **Tree BP:** the collect pass automatically follows a leaf-to-root
  elimination order and caches each eliminated subtree as a message. The
  distribute pass reuses those summaries to recover every node marginal.

Sparse Gaussian elimination with this ordering and Gaussian BP perform the
same algebra. BP simply makes the graph structure, schedule, and reusable
subtree summaries explicit.

$$
\boxed{
\text{Gaussian BP on a tree}
=
\text{Gaussian elimination}
+
\text{graph-aware ordering}.
}
$$

On graphs with cycles, exact elimination generally creates fill-in. The size
of the resulting intermediate cliques—not merely the number of nodes—controls
the cost; this is the idea captured by treewidth.
