import prisma from "@/lib/prisma";
import { assignSubjectColor as pickColor } from "@/lib/subjectColors";

export interface SubjectWithMeta {
  id: string;
  name: string;
  subjectColor: string | null;
  categoryId: string;
  isSharedForSelectedCategory: boolean;
  ownerCategoryId: string;
  ownerCategoryName: string;
}

/**
 * Returns all subjects visible under a given category:
 * - Direct subjects (Subject.categoryId === categoryId)
 * - Shared subjects (linked via CategorySubject junction table)
 * De-duplicated by subject ID. Direct subjects take priority.
 */
export async function getSubjectsForCategory(categoryId: string): Promise<SubjectWithMeta[]> {
  const [direct, junctions] = await Promise.all([
    prisma.subject.findMany({
      where: { categoryId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.categorySubject.findMany({
      where: { categoryId },
      include: {
        subject: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const seen = new Set<string>(direct.map(s => s.id));

  const directWithMeta: SubjectWithMeta[] = direct.map(s => ({
    id: s.id,
    name: s.name,
    subjectColor: s.subjectColor,
    categoryId: s.categoryId,
    isSharedForSelectedCategory: false,
    ownerCategoryId: s.categoryId,
    ownerCategoryName: s.category.name,
  }));

  const sharedWithMeta: SubjectWithMeta[] = junctions
    .filter(cs => !seen.has(cs.subject.id))
    .map(cs => ({
      id: cs.subject.id,
      name: cs.subject.name,
      subjectColor: cs.subject.subjectColor,
      categoryId: cs.subject.categoryId,
      isSharedForSelectedCategory: true,
      ownerCategoryId: cs.subject.categoryId,
      ownerCategoryName: cs.subject.category.name,
    }));

  return [...directWithMeta, ...sharedWithMeta].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Syncs CategorySubject rows for a subject.
 * Removes any existing secondary mappings not in the new list, adds new ones.
 * Never touches the Subject.categoryId (primary category).
 */
export async function syncCategorySubjectMappings(
  subjectId: string,
  secondaryCategoryIds: string[]
): Promise<void> {
  await prisma.categorySubject.deleteMany({ where: { subjectId } });
  if (secondaryCategoryIds.length > 0) {
    await prisma.categorySubject.createMany({
      data: secondaryCategoryIds.map(categoryId => ({ categoryId, subjectId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Returns a subject color: uses provided value or picks from controlled palette.
 */
export function assignSubjectColor(inputColor?: string | null): string {
  return pickColor(inputColor);
}
