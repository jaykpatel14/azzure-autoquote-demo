import { prisma } from "@/lib/prisma";

export async function getSettingsProfileData(companyId: string, userId: string) {
  const [user, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        kioskPinHash: true
      }
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        websiteUrl: true,
        aboutUs: true,
        primaryColor: true,
        showroomBackgroundColor: true,
        showroomBackgroundMediaKey: true,
        showroomBackgroundMediaType: true,
        showroomOverlayColor: true,
        showroomOverlayOpacity: true,
        showroomTextColor: true,
        showroomBackgroundFit: true,
        showroomBackgroundPosition: true,
        showroomPanelOpacity: true,
        memberships: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    })
  ]);

  return { user, company };
}

export async function getSettingsTeamData(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      websiteUrl: true,
      aboutUs: true,
      primaryColor: true,
      showroomBackgroundColor: true,
      showroomBackgroundMediaKey: true,
      showroomBackgroundMediaType: true,
      showroomOverlayColor: true,
      showroomOverlayOpacity: true,
      showroomTextColor: true,
      showroomBackgroundFit: true,
      showroomBackgroundPosition: true,
      showroomPanelOpacity: true,
      memberships: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      }
    }
  });
}
