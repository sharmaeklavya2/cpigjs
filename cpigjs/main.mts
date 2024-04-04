import { Edge, Graph } from "./graph.mjs";
import { Info, SetFamily } from "./setFamily.mjs";

interface ConstrEdge extends Edge<string> {
    under: any;
}

interface CpigInput {
    predicates?: Info[];
    implications?: ConstrEdge[];
}

export function filterByConstraint(inputs: CpigInput[], constraint: unknown, sf: SetFamily): CpigInput {
    const predicates = [], imps = [];
    const newConstr = sf.validateInput(constraint);
    for(const input of inputs) {
        if(input.predicates) {
            predicates.push(...input.predicates);
        }
        for(const imp of input.implications || []) {
            if (sf.contains(imp.under, newConstr)) {
                imps.push(imp);
            }
        }
    }
    return {'predicates': predicates, 'implications': imps};
}
