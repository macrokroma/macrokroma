import VectorPotentialTheory from "../content/vector-potential.mdx";

/**
 * ABVectorPotential — Section 2: The vector potential.
 *
 * Thorough development of classical EM, potentials, tensors,
 * and gauge invariance. Sets up the classical argument against
 * the physical reality of A, which the AB effect will break.
 */
export function ABVectorPotential() {
  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
      <div className="mdx-content">
        <VectorPotentialTheory />
      </div>
    </div>
  );
}