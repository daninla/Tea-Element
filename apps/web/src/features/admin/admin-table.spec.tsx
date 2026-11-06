/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminTable } from './admin-table';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it('provides a labeled keyboard-scrollable data table with scoped column headers', async () => {
  const container = document.createElement('div'),
    root = createRoot(container);
  document.body.append(container);
  try {
    await act(async () =>
      root.render(
        <AdminTable caption="Journal" headings={['Date', 'Action']}>
          <tr>
            <td>2026-11-06</td>
            <td>Saved</td>
          </tr>
        </AdminTable>,
      ),
    );
    const region = container.querySelector('[role=region]');
    expect(region?.getAttribute('aria-label')).toBe('Journal');
    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('caption')?.textContent).toBe('Journal');
    expect(container.querySelectorAll('th[scope=col]')).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
