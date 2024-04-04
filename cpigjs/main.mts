import { Edge, Graph } from "./graph.mjs";
import { Info, SetFamily } from "./setFamily.mjs";

interface ConstrEdge extends Edge<string> {
    under: any;
}

interface CpigInput {
    predicates: Info[];
    implications: ConstrEdge[];
}

export function filterByConstraint(input: CpigInput, constraint: unknown, sf: SetFamily): CpigInput {
    const predicates = input.predicates, imps = input.implications;
    const newImps = [];
    const newConstr = sf.validateInput(constraint);
    for(const imp of imps) {
        if (sf.contains(imp.under, newConstr)) {
            newImps.push(imp);
        }
    }
    return {'predicates': predicates, 'implications': newImps};
}
