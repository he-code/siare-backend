export interface PageInput {
  page?: number;
  pageSize?: number;
}

export const pageOf = (input: PageInput) => {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const paginated = <T>(data: T[], total: number, page: number, pageSize: number) => ({
  data,
  pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
});
