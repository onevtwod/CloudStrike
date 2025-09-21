import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { CloudWatchLogsClient, CreateLogGroupCommand, CreateLogStreamCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudWatchLogs = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface ScrapingEvent {
    platform: 'twitter' | 'reddit' | 'news';
    keywords?: string[];
    maxResults?: number;
    since?: string;
}

interface SocialMediaPost {
    id: string;
    platform: string;
    text: string;
    author: string;
    createdAt: string;
    url: string;
    location?: string;
    hashtags?: string[];
    mentions?: string[];
    mediaUrls?: string[];
    engagement?: {
        likes: number;
        shares: number;
        comments: number;
    };
}

interface ApiCredentials {
    twitterBearerToken?: string;
    redditClientId?: string;
    redditClientSecret?: string;
    newsApiKey?: string;
}

export const handler = async (event: ScrapingEvent): Promise<{ processed: number; queued: number }> => {
    console.log('Starting social media scraping:', event);

    try {
        // Get API credentials from Secrets Manager
        const credentials = await getApiCredentials();

        // Define disaster keywords
        const disasterKeywords = event.keywords || getDefaultDisasterKeywords();

        let processed = 0;
        let queued = 0;

        // Scrape from different platforms
        if (event.platform === 'twitter' || event.platform === 'all') {
            const twitterPosts = await scrapeTwitter(credentials, disasterKeywords, event.maxResults || 50);
            for (const post of twitterPosts) {
                await queuePostForProcessing(post);
                queued++;
            }
            processed += twitterPosts.length;
        }

        if (event.platform === 'reddit' || event.platform === 'all') {
            const redditPosts = await scrapeReddit(credentials, disasterKeywords, event.maxResults || 50);
            for (const post of redditPosts) {
                await queuePostForProcessing(post);
                queued++;
            }
            processed += redditPosts.length;
        }

        if (event.platform === 'news' || event.platform === 'all') {
            const newsPosts = await scrapeNews(credentials, disasterKeywords, event.maxResults || 30);
            for (const post of newsPosts) {
                await queuePostForProcessing(post);
                queued++;
            }
            processed += newsPosts.length;
        }

        // Log metrics to CloudWatch
        await logMetrics({
            platform: event.platform,
            postsProcessed: processed,
            postsQueued: queued,
            timestamp: new Date().toISOString()
        });

        console.log(`Scraping completed: ${processed} posts processed, ${queued} queued for analysis`);
        return { processed, queued };

    } catch (error) {
        console.error('Error in social media scraping:', error);
        throw error;
    }
};

async function getApiCredentials(): Promise<ApiCredentials> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: process.env.SOCIAL_MEDIA_CREDENTIALS_SECRET || 'disaster-alert/social-media-credentials'
        });

        const response = await secretsManager.send(command);
        return JSON.parse(response.SecretString || '{}');
    } catch (error) {
        console.warn('Could not retrieve credentials from Secrets Manager, using environment variables');
        return {
            twitterBearerToken: process.env.TWITTER_BEARER_TOKEN,
            redditClientId: process.env.REDDIT_CLIENT_ID,
            redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
            newsApiKey: process.env.NEWS_API_KEY
        };
    }
}

function getDefaultDisasterKeywords(): string[] {
    return [
        // English
        'flood', 'flooding', 'storm', 'thunderstorm', 'earthquake', 'fire', 'landslide',
        'emergency', 'disaster', 'evacuation', 'rescue', 'damage', 'injury', 'casualty',
        'hurricane', 'tornado', 'cyclone', 'typhoon', 'blizzard', 'drought', 'wildfire',
        'tsunami', 'volcanic', 'eruption', 'avalanche', 'mudslide', 'sinkhole',

        // Malay/Bahasa Malaysia
        'banjir', 'ribut', 'ribut petir', 'gempa bumi', 'kebakaran', 'tanah runtuh',
        'kecemasan', 'bencana', 'evakuasi', 'penyelamatan', 'kerosakan', 'cedera',
        'tsunami', 'gunung berapi', 'letusan', 'salji runtuh', 'tanah runtuh',

        // Location keywords for Malaysia
        'kuala lumpur', 'kl', 'petaling jaya', 'pj', 'shah alam', 'selangor',
        'penang', 'georgetown', 'johor', 'johor bahru', 'melaka', 'malacca',
        'sabah', 'kota kinabalu', 'sarawak', 'kuching', 'kelantan', 'terengganu',
        'kedah', 'perak', 'perlis', 'pahang', 'negeri sembilan', 'putrajaya'
    ];
}

async function scrapeTwitter(credentials: ApiCredentials, keywords: string[], maxResults: number): Promise<SocialMediaPost[]> {
    if (!credentials.twitterBearerToken) {
        console.warn('Twitter credentials not available, skipping Twitter scraping');
        return [];
    }

    const posts: SocialMediaPost[] = [];
    const query = keywords.slice(0, 10).join(' OR '); // Twitter API limit

    try {
        const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,author_id,public_metrics,context_annotations,geo&user.fields=username,name&expansions=author_id`, {
            headers: {
                'Authorization': `Bearer ${credentials.twitterBearerToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const users = data.includes?.users || [];

        for (const tweet of data.data || []) {
            const author = users.find((u: any) => u.id === tweet.author_id);

            posts.push({
                id: `twitter_${tweet.id}`,
                platform: 'twitter',
                text: tweet.text,
                author: author?.username || 'unknown',
                createdAt: tweet.created_at,
                url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
                hashtags: extractHashtags(tweet.text),
                mentions: extractMentions(tweet.text),
                engagement: {
                    likes: tweet.public_metrics?.like_count || 0,
                    shares: tweet.public_metrics?.retweet_count || 0,
                    comments: tweet.public_metrics?.reply_count || 0
                }
            });
        }
    } catch (error) {
        console.error('Error scraping Twitter:', error);
    }

    return posts;
}

async function scrapeReddit(credentials: ApiCredentials, keywords: string[], maxResults: number): Promise<SocialMediaPost[]> {
    if (!credentials.redditClientId || !credentials.redditClientSecret) {
        console.warn('Reddit credentials not available, skipping Reddit scraping');
        return [];
    }

    const posts: SocialMediaPost[] = [];

    try {
        // Get Reddit access token
        const authResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${credentials.redditClientId}:${credentials.redditClientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        // Search Reddit
        const subreddits = ['malaysia', 'kualalumpur', 'malaysia_news', 'disaster', 'emergency'];

        for (const subreddit of subreddits) {
            const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(keywords.slice(0, 5).join(' OR '))}&sort=new&limit=${Math.min(maxResults, 25)}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'DisasterAlertBot/1.0'
                }
            });

            if (!response.ok) continue;

            const data = await response.json();

            for (const post of data.data?.children || []) {
                const postData = post.data;
                posts.push({
                    id: `reddit_${postData.id}`,
                    platform: 'reddit',
                    text: `${postData.title} ${postData.selftext || ''}`,
                    author: postData.author,
                    createdAt: new Date(postData.created_utc * 1000).toISOString(),
                    url: `https://reddit.com${postData.permalink}`,
                    hashtags: extractHashtags(postData.title + ' ' + (postData.selftext || '')),
                    engagement: {
                        likes: postData.ups || 0,
                        shares: 0,
                        comments: postData.num_comments || 0
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error scraping Reddit:', error);
    }

    return posts;
}

async function scrapeNews(credentials: ApiCredentials, keywords: string[], maxResults: number): Promise<SocialMediaPost[]> {
    if (!credentials.newsApiKey) {
        console.warn('News API credentials not available, skipping news scraping');
        return [];
    }

    const posts: SocialMediaPost[] = [];

    try {
        const query = keywords.slice(0, 5).join(' OR ');
        const response = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${maxResults}&apiKey=${credentials.newsApiKey}`);

        if (!response.ok) {
            throw new Error(`News API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        for (const article of data.articles || []) {
            posts.push({
                id: `news_${article.url?.split('/').pop() || Date.now()}`,
                platform: 'news',
                text: `${article.title} ${article.description || ''}`,
                author: article.author || article.source?.name || 'unknown',
                createdAt: article.publishedAt,
                url: article.url,
                location: article.source?.name,
                hashtags: extractHashtags(article.title + ' ' + (article.description || ''))
            });
        }
    } catch (error) {
        console.error('Error scraping news:', error);
    }

    return posts;
}

function extractHashtags(text: string): string[] {
    const hashtagRegex = /#\w+/g;
    return text.match(hashtagRegex) || [];
}

function extractMentions(text: string): string[] {
    const mentionRegex = /@\w+/g;
    return text.match(mentionRegex) || [];
}

async function queuePostForProcessing(post: SocialMediaPost): Promise<void> {
    const command = new SendMessageCommand({
        QueueUrl: process.env.SOCIAL_MEDIA_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789012/disaster-social-media-queue',
        MessageBody: JSON.stringify({
            ...post,
            queuedAt: new Date().toISOString()
        }),
        MessageAttributes: {
            platform: {
                DataType: 'String',
                StringValue: post.platform
            },
            priority: {
                DataType: 'String',
                StringValue: 'normal'
            }
        }
    });

    await sqs.send(command);
}

async function logMetrics(metrics: any): Promise<void> {
    try {
        const logGroupName = '/aws/lambda/disaster-alert-social-scraper';
        const logStreamName = `scraper-${new Date().toISOString().split('T')[0]}`;

        // Create log group if it doesn't exist
        try {
            await cloudWatchLogs.send(new CreateLogGroupCommand({
                logGroupName
            }));
        } catch (error) {
            // Log group might already exist
        }

        // Create log stream if it doesn't exist
        try {
            await cloudWatchLogs.send(new CreateLogStreamCommand({
                logGroupName,
                logStreamName
            }));
        } catch (error) {
            // Log stream might already exist
        }

        // Send log event
        await cloudWatchLogs.send(new PutLogEventsCommand({
            logGroupName,
            logStreamName,
            logEvents: [{
                timestamp: Date.now(),
                message: JSON.stringify(metrics)
            }]
        }));
    } catch (error) {
        console.error('Error logging metrics:', error);
    }
}
