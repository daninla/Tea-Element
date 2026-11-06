import type { ReactNode } from 'react';
export function AdminTableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    // Keyboard users must be able to scroll this named region.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="admin-table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
export function AdminTable({
  caption,
  headings,
  children,
}: {
  caption: string;
  headings: string[];
  children: ReactNode;
}) {
  return (
    <AdminTableScroll label={caption}>
      <table className={headings.length <= 3 ? 'admin-table admin-table-compact' : 'admin-table'}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headings.map((x, i) => (
              <th scope="col" key={i}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </AdminTableScroll>
  );
}
