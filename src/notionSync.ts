import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Task } from './domain';

const NOTION_API = 'https://api.notion.com/v1';
// Replace these with your own Notion database IDs (see tools/save-notion-credential.ps1)
const TASKS_DB_ID = 'YOUR_TASKS_DATABASE_ID';
const HABITS_DB_ID = 'YOUR_HABITS_DATABASE_ID';
export const LIBRARY_DB_ID = 'YOUR_LIBRARY_DATABASE_ID';

const TASK_NOTION_ICON = {
  type: 'icon',
  icon: {
    name: 'checklist',
    color: 'yellow',
  },
};

let cachedToken: string | null = null;

export async function getNotionToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!isTauri()) return null;
  try {
    const token = await invoke<string>('get_notion_token');
    if (token) {
      cachedToken = token;
      return token;
    }
  } catch (e) {
    console.warn('Could not read Notion token:', e);
  }
  return null;
}

export async function syncTaskToNotion(task: Task): Promise<string | null> {
  const token = await getNotionToken();
  if (!token) return null;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    if (task.remoteId) {
      // Patch existing task in Notion
      const properties: Record<string, any> = {
        Done: { checkbox: task.done },
        Name: { title: [{ text: { content: task.title } }] },
      };
      if (task.day) {
        properties['Due Date'] = { date: { start: task.day } };
      }

      const res = await fetch(`${NOTION_API}/pages/${task.remoteId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          properties,
          icon: TASK_NOTION_ICON,
        }),
      });

      if (res.ok) {
        return task.remoteId;
      } else {
        console.warn('Notion task update failed:', await res.text());
      }
    } else {
      // Create new task in Notion Tasks DB
      const properties: Record<string, any> = {
        Name: { title: [{ text: { content: task.title } }] },
        Done: { checkbox: task.done },
      };
      if (task.day) {
        properties['Due Date'] = { date: { start: task.day } };
      }

      const res = await fetch(`${NOTION_API}/pages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { database_id: TASKS_DB_ID },
          properties,
          icon: TASK_NOTION_ICON,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.id as string;
      } else {
        console.warn('Notion task creation failed:', await res.text());
      }
    }
  } catch (err) {
    console.warn('Error syncing task to Notion:', err);
  }
  return null;
}

export interface NotionHabitRecord {
  id: string;
  day: string;
  checks: Record<string, boolean>;
}

export async function pullHabitsFromNotion(pageSize = 14): Promise<NotionHabitRecord[]> {
  const token = await getNotionToken();
  if (!token) return [];

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(`${NOTION_API}/databases/${HABITS_DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        page_size: pageSize,
        sorts: [
          {
            property: 'Date',
            direction: 'descending',
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn('Could not query Notion habits:', await res.text());
      return [];
    }

    const data = await res.json();
    const records: NotionHabitRecord[] = [];

    for (const page of data.results || []) {
      const dateProp = page.properties?.Date;
      const day = dateProp?.date?.start;
      if (!day || typeof day !== 'string') continue;

      const checks: Record<string, boolean> = {};
      for (const [key, prop] of Object.entries(page.properties || {})) {
        if ((prop as any)?.type === 'checkbox') {
          checks[key] = Boolean((prop as any).checkbox);
        }
      }

      records.push({
        id: page.id,
        day,
        checks,
      });
    }

    return records;
  } catch (err) {
    console.warn('Error pulling habits from Notion:', err);
    return [];
  }
}

export async function syncHabitToNotion(
  day: string,
  habitName: string,
  done: boolean,
  habitPageId?: string
): Promise<string | null> {
  const token = await getNotionToken();
  if (!token) return null;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    let targetPageId = habitPageId;

    if (targetPageId) {
      // Attempt to patch existing page directly
      const patchRes = await fetch(`${NOTION_API}/pages/${targetPageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          properties: {
            [habitName]: { checkbox: done },
          },
        }),
      });

      if (patchRes.ok) {
        return targetPageId;
      }
      // If direct PATCH failed (e.g. 404 because targetPageId was a client-side random UUID),
      // fall back to querying Notion Habits DB by Date to find or create the real page.
      console.warn(`Notion habit direct patch failed for ${targetPageId} (${patchRes.status}), querying by Date ${day}...`);
      targetPageId = undefined;
    }

    // Query Notion habits DB for this date
    const queryRes = await fetch(`${NOTION_API}/databases/${HABITS_DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Date',
          date: { equals: day },
        },
        page_size: 1,
      }),
    });

    if (queryRes.ok) {
      const queryData = await queryRes.json();
      if (queryData.results && queryData.results.length > 0) {
        targetPageId = queryData.results[0].id;
      }
    }

    if (targetPageId) {
      // Patch habit on existing day page found by date
      const res = await fetch(`${NOTION_API}/pages/${targetPageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          properties: {
            [habitName]: { checkbox: done },
          },
        }),
      });

      if (res.ok) {
        return targetPageId;
      } else {
        console.warn('Notion habit update failed:', await res.text());
      }
    } else {
      // Create new day page in Habits database
      const dayDate = new Date(day + 'T12:00:00');
      const dayLabel = dayDate.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const res = await fetch(`${NOTION_API}/pages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { database_id: HABITS_DB_ID },
          properties: {
            Name: { title: [{ text: { content: dayLabel } }] },
            Date: { date: { start: day } },
            [habitName]: { checkbox: done },
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.id as string;
      } else {
        console.warn('Notion habit page creation failed:', await res.text());
      }
    }
  } catch (err) {
    console.warn('Error syncing habit to Notion:', err);
  }
  return null;
}

export async function archiveTaskInNotion(remoteId: string): Promise<boolean> {
  const token = await getNotionToken();
  if (!token) return false;
  try {
    const res = await fetch(`${NOTION_API}/pages/${remoteId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ archived: true }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error archiving task in Notion:', err);
    return false;
  }
}

export interface NotionBook {
  id: string;
  title: string;
  status: 'To read' | 'Reading' | 'Read' | 'Stopped' | string;
  currentPage: number;
  totalPages: number;
  summary?: string;
  genre?: string[];
  coverUrl?: string;
  notionUrl?: string;
  lastEditedTime?: string;
}

export async function searchBooksInNotion(query: string = ''): Promise<NotionBook[]> {
  const token = await getNotionToken();
  if (!token) return [];

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const body: any = { page_size: 20 };
  const q = query.trim();
  if (q) {
    body.filter = {
      property: 'Title of the book',
      title: { contains: q },
    };
  } else {
    // Show active or recently read books
    body.filter = {
      or: [
        { property: 'Reading - Status', status: { equals: 'Reading' } },
        { property: 'Pages - Where are you at', number: { is_not_empty: true } },
      ],
    };
    body.sorts = [
      { timestamp: 'last_edited_time', direction: 'descending' },
    ];
  }

  try {
    const res = await fetch(`${NOTION_API}/databases/${LIBRARY_DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('Could not query Notion library:', await res.text());
      return [];
    }

    const data = await res.json();
    return (data.results || []).map((page: any): NotionBook => {
      const props = page.properties || {};
      const title = (props['Title of the book']?.title || [])
        .map((t: any) => t.plain_text)
        .join('') || 'Untitled Book';
      const status = props['Reading - Status']?.status?.name || 'To read';
      const currentPage = props['Pages - Where are you at']?.number ?? 0;
      const totalPages = props['Pages - Total number of page']?.number 
        ?? props['Pages']?.number 
        ?? 0;
      const summary = (props['Summary']?.rich_text || [])
        .map((t: any) => t.plain_text)
        .join('');
      const genre = (props['Genre']?.multi_select || []).map((g: any) => g.name);
      const coverUrl = page.cover?.file?.url || page.cover?.external?.url;

      return {
        id: page.id,
        title,
        status,
        currentPage,
        totalPages,
        summary,
        genre,
        coverUrl,
        notionUrl: page.url,
        lastEditedTime: page.last_edited_time,
      };
    });
  } catch (err) {
    console.warn('Error querying Notion library:', err);
    return [];
  }
}

export async function updateBookProgressInNotion(
  bookId: string,
  newPage: number,
  options?: { markFinished?: boolean; totalPages?: number }
): Promise<boolean> {
  const token = await getNotionToken();
  if (!token) return false;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const isCompleted = Boolean(
    options?.markFinished ||
      (options?.totalPages && options.totalPages > 0 && newPage >= options.totalPages)
  );

  const properties: Record<string, any> = {
    'Pages - Where are you at': { number: newPage },
  };

  if (isCompleted) {
    properties['Reading - Status'] = { status: { name: 'Read' } };
    properties['Finish Date'] = { date: { start: new Date().toISOString().slice(0, 10) } };
  } else {
    properties['Reading - Status'] = { status: { name: 'Reading' } };
  }

  try {
    const res = await fetch(`${NOTION_API}/pages/${bookId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error updating book in Notion:', err);
    return false;
  }
}
