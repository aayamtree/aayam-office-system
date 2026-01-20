/**
 * Google Calendar Integration
 * Auto-create Calendar events for project deadlines with reminders
 */

export interface CalendarEvent {
    summary: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    reminders?: {
        useDefault: boolean;
        overrides?: Array<{
            method: 'email' | 'popup';
            minutes: number;
        }>;
    };
}

export interface CalendarEventResult {
    success: boolean;
    eventId?: string;
    eventLink?: string;
    error?: string;
}

/**
 * Create a Calendar event for a project deadline
 */
export async function createCalendarEvent(
    accessToken: string,
    event: CalendarEvent
): Promise<CalendarEventResult> {
    try {
        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.error?.message || 'Failed to create event' };
        }

        const data = await response.json();

        return {
            success: true,
            eventId: data.id,
            eventLink: data.htmlLink,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing Calendar event
 */
export async function updateCalendarEvent(
    accessToken: string,
    eventId: string,
    event: Partial<CalendarEvent>
): Promise<CalendarEventResult> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            return { success: false, error: 'Failed to update event' };
        }

        const data = await response.json();
        return {
            success: true,
            eventId: data.id,
            eventLink: data.htmlLink,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete a Calendar event
 */
export async function deleteCalendarEvent(
    accessToken: string,
    eventId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            return { success: false, error: 'Failed to delete event' };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Format project data into Calendar event
 */
export function createProjectCalendarEvent(
    projectName: string,
    deadline: string,
    description?: string,
    driveLink?: string
): CalendarEvent {
    // Create all-day event for deadline
    const eventDescription = [
        description || 'Project deadline',
        driveLink ? `\nFiles: ${driveLink}` : '',
    ].filter(Boolean).join('\n');

    return {
        summary: `🎨 ${projectName} - Deadline`,
        description: eventDescription,
        start: {
            date: deadline, // All-day event
        },
        end: {
            date: deadline,
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 }, // 1 day before
                { method: 'popup', minutes: 60 },      // 1 hour before
            ],
        },
    };
}
