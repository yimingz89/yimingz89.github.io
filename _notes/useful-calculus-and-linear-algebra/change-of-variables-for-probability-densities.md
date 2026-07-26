---
title: "Change of Variables for Probability Densities"
topic: "Useful Calculus and Linear Algebra"
summary: "Jacobians as local volume corrections when transforming a probability density."
order: 1
---

The core idea is simple: a transformation preserves **probability mass**, not
density. The density must compensate for any local expansion or contraction of
volume.

## Change-of-Variables Formula

Let $\mathbf U\in\mathbb R^n$ have density $p_{\mathbf U}$, and let

$$
\mathbf Z=g(\mathbf U),
$$

where $g:\mathbb R^n\to\mathbb R^n$ is invertible and differentiable, with a
differentiable inverse. Then

$$
\boxed{
p_{\mathbf Z}(\mathbf z)
=
p_{\mathbf U}\!\left(g^{-1}(\mathbf z)\right)
\left|
\det Dg^{-1}(\mathbf z)
\right|
}.
$$

Equivalently, if $\mathbf z=g(\mathbf u)$,

$$
\boxed{
p_{\mathbf Z}(g(\mathbf u))
=
\frac{p_{\mathbf U}(\mathbf u)}
{\left|\det Dg(\mathbf u)\right|}
}.
$$

Here $Dg(\mathbf u)$ is the **Jacobian matrix**

$$
Dg(\mathbf u)
=
\left[
\frac{\partial g_i}{\partial u_j}(\mathbf u)
\right]_{i,j=1}^n.
$$

When $\mathbf z=g(\mathbf u)$, the inverse-function theorem gives

$$
Dg^{-1}(\mathbf z)
=
\left[Dg(\mathbf u)\right]^{-1}.
$$

<details class="proof-disclosure">
  <summary>Derivation from conservation of probability</summary>
  <div class="proof-body" markdown="1">

For any measurable region $B$,

$$
\begin{aligned}
\Pr(\mathbf Z\in B)
&=
\Pr\!\left(\mathbf U\in g^{-1}(B)\right)\\
&=
\int_{g^{-1}(B)}
p_{\mathbf U}(\mathbf u)\,d\mathbf u.
\end{aligned}
$$

Change integration variables using
$\mathbf u=g^{-1}(\mathbf z)$. The corresponding volume elements satisfy

$$
d\mathbf u
=
\left|\det Dg^{-1}(\mathbf z)\right|
d\mathbf z.
$$

Therefore

$$
\Pr(\mathbf Z\in B)
=
\int_B
p_{\mathbf U}\!\left(g^{-1}(\mathbf z)\right)
\left|\det Dg^{-1}(\mathbf z)\right|
d\mathbf z.
$$

Since this holds for every $B$, the integrand is the density
$p_{\mathbf Z}(\mathbf z)$.

  </div>
</details>

## The Jacobian as Local Volume Scaling

Near $\mathbf u$, a differentiable map is approximately linear:

$$
g(\mathbf u+\Delta\mathbf u)
\approx
g(\mathbf u)+Dg(\mathbf u)\Delta\mathbf u.
$$

Thus the Jacobian controls how a tiny region is transformed. For the volume
elements,

$$
\boxed{
d\mathbf z
=
\left|\det Dg(\mathbf u)\right|
d\mathbf u
}.
$$

Here $d\mathbf u=du_1\cdots du_n$ and
$d\mathbf z=dz_1\cdots dz_n$ denote volumes. This is distinct from the vector
differential relation

$$
d\mathbf z=Dg(\mathbf u)\,d\mathbf u.
$$

If the map expands a small volume by a factor of $c$, the same probability mass
is spread over $c$ times as much space, so the density is divided by $c$:

$$
p_{\mathbf Z}(\mathbf z)\,d\mathbf z
=
p_{\mathbf U}(\mathbf u)\,d\mathbf u.
$$

## Affine Transformations

For

$$
\mathbf Z=A\mathbf U+\mathbf b,
$$

with invertible $A$,

$$
Dg(\mathbf u)=A,
\qquad
Dg^{-1}(\mathbf z)=A^{-1}.
$$

Therefore

$$
\boxed{
p_{\mathbf Z}(\mathbf z)
=
p_{\mathbf U}\!\left(A^{-1}(\mathbf z-\mathbf b)\right)
|\det A|^{-1}
}.
$$

For example, if

$$
A=
\begin{bmatrix}
2&0\\
0&3
\end{bmatrix},
$$

then areas are multiplied by $|\det A|=6$, so the transformed density is
divided by $6$.

## Why the Determinant Appears

The columns of $A$ are the images of the coordinate basis vectors. Therefore
$A$ maps the unit cube to the parallelepiped whose edge vectors are the columns
of $A$.

Its volume is

$$
\boxed{
\operatorname{Vol}(A[0,1]^n)=|\det A|
}.
$$

The sign of $\det A$ records orientation; the absolute value records physical
volume. If $\det A=0$, the transformation collapses at least one dimension, so
the image has zero $n$-dimensional volume.

<details class="proof-disclosure">
  <summary>Proof that the determinant gives parallelepiped volume</summary>
  <div class="proof-body" markdown="1">

Let the columns of $A$ be the edge vectors
$\mathbf v_1,\ldots,\mathbf v_n$. Apply Gram–Schmidt, or equivalently take a
QR factorization:

$$
A=QR.
$$

$Q$ is orthogonal, so it only rotates or reflects and does not change volume:

$$
|\det Q|=1.
$$

$R$ is upper triangular. Its diagonal entries
$r_{11},\ldots,r_{nn}$ are the successive perpendicular heights obtained by
Gram–Schmidt. Repeated base-times-height therefore gives

$$
\operatorname{Vol}
=
|r_{11}\cdots r_{nn}|.
$$

Because the determinant of a triangular matrix is the product of its diagonal
entries,

$$
\begin{aligned}
\operatorname{Vol}
&=
|\det R|\\
&=
|\det Q|\,|\det R|\\
&=
|\det(QR)|\\
&=
|\det A|.
\end{aligned}
$$

If the columns are linearly dependent, one perpendicular height is zero; both
the volume and determinant are then zero.

  </div>
</details>

## Gaussian Example

Let

$$
\mathbf X=A\mathbf U+\boldsymbol\mu,
\qquad
\mathbf U\sim\mathcal N(\mathbf0,I_n),
$$

with $A$ invertible. Change of variables gives

$$
p_{\mathbf X}(\mathbf x)
=
p_{\mathbf U}\!\left(A^{-1}(\mathbf x-\boldsymbol\mu)\right)
|\det A|^{-1}.
$$

Set $\Sigma=AA^\mathsf T$. Then

$$
|\det A|=|\Sigma|^{1/2},
$$

and

$$
\left\|A^{-1}(\mathbf x-\boldsymbol\mu)\right\|^2
=
(\mathbf x-\boldsymbol\mu)^\mathsf T
\Sigma^{-1}
(\mathbf x-\boldsymbol\mu).
$$

Hence

$$
p_{\mathbf X}(\mathbf x)
=
\frac{1}{(2\pi)^{n/2}|\Sigma|^{1/2}}
\exp\!\left[
-\frac12
(\mathbf x-\boldsymbol\mu)^\mathsf T
\Sigma^{-1}
(\mathbf x-\boldsymbol\mu)
\right].
$$

## Memory Aid

$$
\boxed{
\text{density correction}
=
\frac{1}{\text{local volume expansion}}
}.
$$

- $Dg$ is the local linear approximation to $g$.
- $|\det Dg|$ is its local volume expansion factor.
- The inverse determinant appears because probability mass is conserved.
