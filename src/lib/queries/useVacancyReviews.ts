import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listDocs, setDocById } from "@/lib/data/dataClient";
import type { VacancyReview, VacancyReviewStatusValue } from "@/lib/schemas/vacancyReview";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "vacancyReviews";

export function useVacancyReviewsQuery() {
  return useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<VacancyReview>(COLLECTION),
  });
}

/** Doc id == budgetItemId, so this is an upsert keyed by the line being reviewed. */
export function useSetVacancyReviewMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      budgetItemId,
      status,
      notes,
    }: {
      budgetItemId: string;
      status: VacancyReviewStatusValue;
      notes?: string;
    }) => {
      await setDocById(COLLECTION, budgetItemId, {
        budgetItemId,
        status,
        notes: notes ?? "",
        updatedAt: Date.now(),
        updatedBy: user?.uid ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}
