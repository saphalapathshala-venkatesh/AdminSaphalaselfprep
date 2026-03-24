export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getSubjectsForCategory, syncCategorySubjectMappings, assignSubjectColor } from "@/lib/taxonomy";

// Taxonomy hierarchy: Category → Subject → Topic → Subtopic
type TaxonomyLevel = "category" | "subject" | "topic" | "subtopic";

function isValidLevel(level: string): level is TaxonomyLevel {
  return ["category", "subject", "topic", "subtopic"].includes(level);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const level    = searchParams.get("level");
  const parentId = searchParams.get("parentId");
  const search   = searchParams.get("search");
  const tree     = searchParams.get("tree");
  const id       = searchParams.get("id");

  // Full tree including shared subjects
  if (tree === "true") {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        subjects: {
          include: {
            topics: {
              include: {
                subtopics: { orderBy: { name: "asc" } },
              },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
        // Shared subjects via junction table
        categorySubjects: {
          include: {
            subject: {
              include: {
                category: { select: { id: true, name: true } },
                topics: {
                  include: {
                    subtopics: { orderBy: { name: "asc" } },
                  },
                  orderBy: { name: "asc" },
                },
              },
            },
          },
        },
      },
    });
    return NextResponse.json({ data: categories });
  }

  if (!level || !isValidLevel(level)) {
    return NextResponse.json(
      { error: "Invalid or missing 'level' parameter. Must be: category, subject, topic, or subtopic" },
      { status: 400 }
    );
  }

  // Subject detail by id (for loading secondary category mappings in edit mode)
  if (level === "subject" && id && !parentId) {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        categorySubjects: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });
    if (!subject) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: subject });
  }

  try {
    let data: any;
    switch (level) {
      case "category":
        data = await prisma.category.findMany({
          where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
          orderBy: { name: "asc" },
        });
        break;

      case "subject":
        if (parentId) {
          // Union: direct subjects + shared subjects for this category
          data = await getSubjectsForCategory(parentId);
          if (search) {
            const lq = search.toLowerCase();
            data = data.filter((s: any) => s.name.toLowerCase().includes(lq));
          }
        } else {
          // No parentId: return all subjects (no shared metadata)
          data = await prisma.subject.findMany({
            where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
            include: { category: { select: { id: true, name: true } } },
            orderBy: { name: "asc" },
          });
        }
        break;

      case "topic":
        data = await prisma.topic.findMany({
          where: {
            ...(parentId ? { subjectId: parentId } : {}),
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          },
          include: { subject: { select: { id: true, name: true, categoryId: true } } },
          orderBy: { name: "asc" },
        });
        break;

      case "subtopic":
        data = await prisma.subtopic.findMany({
          where: {
            ...(parentId ? { topicId: parentId } : {}),
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          },
          include: { topic: { select: { id: true, name: true, subjectId: true } } },
          orderBy: { name: "asc" },
        });
        break;
    }
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Taxonomy GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { level, name, parentId, subjectColor, secondaryCategoryIds } = body;

    if (!level || !isValidLevel(level)) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    if (!name || typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    let created: any;

    switch (level) {
      case "category": {
        created = await prisma.category.create({ data: { name: name.trim() } });
        break;
      }
      case "subject": {
        if (!parentId) return NextResponse.json({ error: "categoryId (parentId) is required" }, { status: 400 });
        const color = assignSubjectColor(subjectColor);
        created = await prisma.subject.create({
          data: { name: name.trim(), categoryId: parentId, subjectColor: color },
        });
        // Sync secondary category mappings
        if (Array.isArray(secondaryCategoryIds) && secondaryCategoryIds.length > 0) {
          const filtered = secondaryCategoryIds.filter((cid: string) => cid !== parentId);
          await syncCategorySubjectMappings(created.id, filtered);
        }
        break;
      }
      case "topic": {
        if (!parentId) return NextResponse.json({ error: "subjectId (parentId) is required" }, { status: 400 });
        created = await prisma.topic.create({ data: { name: name.trim(), subjectId: parentId } });
        break;
      }
      case "subtopic": {
        if (!parentId) return NextResponse.json({ error: "topicId (parentId) is required" }, { status: 400 });
        created = await prisma.subtopic.create({ data: { name: name.trim(), topicId: parentId } });
        break;
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: "TAXONOMY_CREATE",
      entityType: level.charAt(0).toUpperCase() + level.slice(1),
      entityId: created.id,
      after: { name: created.name, parentId },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "A record with this name already exists at this level" }, { status: 409 });
    if (err?.code === "P2003") return NextResponse.json({ error: "Invalid parent reference" }, { status: 400 });
    console.error("Taxonomy POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { level, id, name, subjectColor, secondaryCategoryIds } = body;

    if (!level || !isValidLevel(level)) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
    if (name !== undefined && (!name || !name.trim())) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });

    let before: any;
    let updated: any;

    switch (level) {
      case "category": {
        before = await prisma.category.findUnique({ where: { id } });
        if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
        updated = await prisma.category.update({ where: { id }, data: { ...(name ? { name: name.trim() } : {}) } });
        break;
      }
      case "subject": {
        before = await prisma.subject.findUnique({ where: { id } });
        if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updateData: Record<string, any> = {};
        if (name) updateData.name = name.trim();
        // Preserve existing color unless explicitly set (including empty string to clear)
        if (subjectColor !== undefined) {
          updateData.subjectColor = subjectColor?.trim() || null;
        }

        updated = await prisma.subject.update({ where: { id }, data: updateData });

        // Sync secondary category mappings (exclude primary category)
        if (Array.isArray(secondaryCategoryIds)) {
          const filtered = secondaryCategoryIds.filter((cid: string) => cid !== updated.categoryId);
          await syncCategorySubjectMappings(id, filtered);
        }
        break;
      }
      case "topic": {
        before = await prisma.topic.findUnique({ where: { id } });
        if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
        updated = await prisma.topic.update({ where: { id }, data: { name: name.trim() } });
        break;
      }
      case "subtopic": {
        before = await prisma.subtopic.findUnique({ where: { id } });
        if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
        updated = await prisma.subtopic.update({ where: { id }, data: { name: name.trim() } });
        break;
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: "TAXONOMY_UPDATE",
      entityType: level.charAt(0).toUpperCase() + level.slice(1),
      entityId: id,
      before: { name: before.name },
      after: { name: updated.name },
    });

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "A record with this name already exists at this level" }, { status: 409 });
    console.error("Taxonomy PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level");
  const id    = searchParams.get("id");
  const force = searchParams.get("force") === "true";

  if (!level || !isValidLevel(level)) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
  if (force && user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only SUPER_ADMIN can force delete" }, { status: 403 });

  const LEVEL_LABELS: Record<TaxonomyLevel, string> = {
    category: "Category", subject: "Subject", topic: "Topic", subtopic: "Subtopic",
  };

  try {
    let deleted: any;

    switch (level) {
      case "category": {
        const record = await prisma.category.findUnique({ where: { id } });
        if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (force) {
          await prisma.subtopic.deleteMany({ where: { topic: { subject: { categoryId: id } } } });
          await prisma.topic.deleteMany({ where: { subject: { categoryId: id } } });
          await prisma.subject.deleteMany({ where: { categoryId: id } });
        }
        deleted = await prisma.category.delete({ where: { id } });
        break;
      }
      case "subject": {
        const record = await prisma.subject.findUnique({ where: { id } });
        if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (force) {
          await prisma.subtopic.deleteMany({ where: { topic: { subjectId: id } } });
          await prisma.topic.deleteMany({ where: { subjectId: id } });
        }
        deleted = await prisma.subject.delete({ where: { id } });
        break;
      }
      case "topic": {
        const record = await prisma.topic.findUnique({ where: { id } });
        if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (force) await prisma.subtopic.deleteMany({ where: { topicId: id } });
        deleted = await prisma.topic.delete({ where: { id } });
        break;
      }
      case "subtopic": {
        const record = await prisma.subtopic.findUnique({ where: { id } });
        if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
        deleted = await prisma.subtopic.delete({ where: { id } });
        break;
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: force ? "TAXONOMY_FORCE_DELETE" : "TAXONOMY_DELETE",
      entityType: LEVEL_LABELS[level as TaxonomyLevel],
      entityId: id,
      before: { name: deleted.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2003") return NextResponse.json({ error: "Cannot delete: record is in use. Use force=true with SUPER_ADMIN to cascade delete." }, { status: 409 });
    console.error("Taxonomy DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
