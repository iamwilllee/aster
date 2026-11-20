import * as React from 'react'

export function Table({ children, className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  // The container scrolls sideways on narrow screens instead of clipping columns.
  return <div data-slot="table-container"><table data-slot="table" className={className} {...props}>{children}</table></div>
}
export function TableHeader({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead data-slot="table-header" className={className} {...props}>{children}</thead>
}
export function TableBody({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody data-slot="table-body" className={className} {...props}>{children}</tbody>
}
export function TableRow({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr data-slot="table-row" className={className} {...props}>{children}</tr>
}
export function TableHead({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th data-slot="table-head" scope="col" className={className} {...props}>{children}</th>
}
export function TableCell({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td data-slot="table-cell" className={className} {...props}>{children}</td>
}
export function TableCaption({ children, className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption data-slot="table-caption" className={className} {...props}>{children}</caption>
}
