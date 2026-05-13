// Slack Integration for Aayam Office
// Optimized for Free Webhook Usage

const SLACK_WEBHOOK_URL = process.env.NEXT_PUBLIC_SLACK_WEBHOOK;

interface DesignNotification {
    jobNumber: string;
    projectName: string;
    clientName: string;
    description: string;
    deadline: string;
    priority: string;
}

/**
 * Sends a notification to the Design Team channel via Webhook
 */
export const notifyDesignTeam = async (data: DesignNotification) => {
    if (!SLACK_WEBHOOK_URL) {
        console.warn('Slack Webhook URL not configured (NEXT_PUBLIC_SLACK_WEBHOOK)');
        return;
    }

    const priorityIcon = data.priority === 'urgent' ? '🔴' : (data.priority === 'high' ? '🟠' : '🔵');

    const message = {
        text: `*New Design Job Assigned* ${priorityIcon}`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `${priorityIcon} New Design Project: ${data.projectName}`,
                    emoji: true
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Client:*\n${data.clientName}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Job Number:*\n${data.jobNumber}`
                    }
                ]
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Deadline:*\n${data.deadline}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Priority:*\n${data.priority.toUpperCase()}`
                    }
                ]
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Description:*\n${data.description || "No description provided."}`
                }
            },
            {
                type: "divider"
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "Sent from Aayam Office System"
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch(SLACK_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            console.error('Failed to send Slack notification');
        }
    } catch (error) {
        console.error('Error sending Slack notification:', error);
    }
};
