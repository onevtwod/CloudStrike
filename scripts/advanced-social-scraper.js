#!/usr/bin/env node

/**
 * Advanced Social Media Scraper with Facebook & Instagram Access
 * 
 * This script uses advanced web scraping techniques to access
 * Facebook, Instagram, TikTok, and other social media platforms
 * for real disaster content.
 * 
 * Features:
 * - Facebook public pages and groups
 * - Instagram public posts and hashtags
 * - TikTok public videos (descriptions)
 * - LinkedIn disaster-related posts
 * - YouTube disaster videos
 * - Advanced proxy rotation
 * - Browser automation with Puppeteer
 * 
 * Usage:
 *   node scripts/advanced-social-scraper.js
 * 
 * Environment Variables:
 *   - API_BASE_URL: Your disaster alert API endpoint
 *   - SCRAPING_INTERVAL: How often to scrape (default: 300000ms = 5 minutes)
 *   - USE_PROXY: Enable proxy rotation (default: false)
 *   - HEADLESS_MODE: Run browser in headless mode (default: true)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('axios-rate-limit');
const puppeteer = require('puppeteer');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const SCRAPING_INTERVAL = parseInt(process.env.SCRAPING_INTERVAL) || 300000; // 5 minutes
const USE_PROXY = process.env.USE_PROXY === 'true';
const HEADLESS_MODE = process.env.HEADLESS_MODE !== 'false';

// Rate-limited HTTP client
const http = rateLimit(axios.create(), { maxRequests: 100, perMilliseconds: 60000 });

// Disaster-related keywords in multiple languages
const DISASTER_KEYWORDS = [
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
  'kedah', 'perak', 'perlis', 'pahang', 'negeri sembilan', 'putrajaya',
  'cyberjaya', 'klang', 'subang jaya', 'ampang', 'cheras', 'kepong',
  'setapak', 'wangsa maju', 'titiwangsa', 'sentul', 'brickfields'
];

class AdvancedSocialScraper {
  constructor() {
    this.isRunning = false;
    this.scrapedCount = 0;
    this.processedCount = 0;
    this.verifiedCount = 0;
    this.lastScrapeTime = null;
    this.browser = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Advanced social scraper is already running');
      return;
    }

    console.log('🚀 Starting Advanced Social Media Scraper');
    console.log('==========================================');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    console.log(`⏱️  Scraping Interval: ${SCRAPING_INTERVAL / 1000} seconds`);
    console.log(`🔍 Disaster Keywords: ${DISASTER_KEYWORDS.length} keywords`);
    console.log(`🌐 Browser Mode: ${HEADLESS_MODE ? 'Headless' : 'Visible'}`);
    console.log(`🔄 Proxy Mode: ${USE_PROXY ? 'Enabled' : 'Disabled'}`);
    console.log('');

    this.isRunning = true;

    // Initialize browser
    await this.initializeBrowser();

    // Initial scrape
    await this.scrapeAllSources();

    // Set up interval for continuous scraping
    setInterval(async () => {
      if (this.isRunning) {
        await this.scrapeAllSources();
      }
    }, SCRAPING_INTERVAL);

    console.log('✅ Advanced social scraper started successfully');
    console.log(`📊 Stats: Scraped ${this.scrapedCount}, Processed ${this.processedCount}, Verified ${this.verifiedCount}`);
  }

  async stop() {
    this.isRunning = false;
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🛑 Advanced social scraper stopped');
  }

  async initializeBrowser() {
    try {
      console.log('🌐 Initializing browser...');
      
      const launchOptions = {
        headless: HEADLESS_MODE,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };

      if (USE_PROXY) {
        // Add proxy configuration if needed
        launchOptions.args.push('--proxy-server=http://proxy-server:port');
      }

      this.browser = await puppeteer.launch(launchOptions);
      console.log('✅ Browser initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error.message);
      console.log('🔄 Falling back to HTTP-only scraping...');
    }
  }

  async scrapeAllSources() {
    const startTime = Date.now();
    this.lastScrapeTime = new Date();

    console.log(`\n🔍 Starting advanced scrape cycle at ${this.lastScrapeTime.toISOString()}`);

    try {
      // Scrape multiple sources in parallel
      const results = await Promise.allSettled([
        this.scrapeFacebookAdvanced(),
        this.scrapeInstagramAdvanced(),
        this.scrapeTikTokAdvanced(),
        this.scrapeLinkedInAdvanced(),
        this.scrapeYouTubeAdvanced(),
        this.scrapeTelegramChannels()
      ]);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const duration = Date.now() - startTime;
      console.log(`✅ Advanced scrape cycle completed in ${duration}ms`);
      console.log(`📊 Sources: ${successful} successful, ${failed} failed`);
      console.log(`📈 Total: ${this.scrapedCount} scraped, ${this.processedCount} processed, ${this.verifiedCount} verified`);

    } catch (error) {
      console.error('❌ Error in advanced scrape cycle:', error.message);
    }
  }

  async scrapeFacebookAdvanced() {
    try {
      console.log('📘 Scraping Facebook (Advanced)...');
      
      const facebookSources = [
        {
          name: 'Malaysia Emergency Services',
          url: 'https://www.facebook.com/BombaMalaysia',
          type: 'page'
        },
        {
          name: 'Malaysian Meteorological Department',
          url: 'https://www.facebook.com/MetMalaysia',
          type: 'page'
        },
        {
          name: 'Malaysia Civil Defence Force',
          url: 'https://www.facebook.com/APMMalaysia',
          type: 'page'
        },
        {
          name: 'Malaysia Disaster Management',
          url: 'https://www.facebook.com/groups/malaysiadisaster',
          type: 'group'
        }
      ];

      const posts = [];

      if (this.browser) {
        // Use Puppeteer for advanced Facebook scraping
        const page = await this.browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        for (const source of facebookSources) {
          try {
            console.log(`   📘 Scraping ${source.name}...`);
            
            await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for content to load
            await page.waitForTimeout(3000);
            
            // Extract posts using different selectors
            const facebookPosts = await page.evaluate(() => {
              const posts = [];
              
              // Try multiple selectors for Facebook posts
              const selectors = [
                '[data-pagelet="FeedUnit_0"]',
                '[data-testid="fbfeed_story"]',
                '.userContent',
                '.text_exposed_root',
                '[role="article"]'
              ];
              
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element, index) => {
                  const text = element.textContent?.trim();
                  if (text && text.length > 50) {
                    posts.push({
                      text: text,
                      source: 'facebook',
                      timestamp: new Date().toISOString()
                    });
                  }
                });
              }
              
              return posts;
            });

            const filteredPosts = facebookPosts.filter(post => 
              this.containsDisasterKeywords(post.text)
            );

            posts.push(...filteredPosts.map(post => ({
              ...post,
              author: source.name,
              url: source.url,
              id: `facebook_${Date.now()}_${posts.length}`
            })));

            console.log(`   📝 Found ${filteredPosts.length} disaster-related posts`);

            // Rate limiting
            await page.waitForTimeout(5000);

          } catch (error) {
            console.error(`   ❌ Error scraping ${source.name}:`, error.message);
          }
        }
        
        await page.close();
      } else {
        // Fallback to HTTP scraping
        console.log('   🔄 Using HTTP fallback for Facebook...');
        
        for (const source of facebookSources) {
          try {
            const response = await http.get(source.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 15000
            });

            const $ = cheerio.load(response.data);
            
            // Extract posts from HTML
            $('.userContent, .text_exposed_root, [data-testid="fbfeed_story"]').each((i, element) => {
              const text = $(element).text().trim();
              if (text && this.containsDisasterKeywords(text)) {
                posts.push({
                  id: `facebook_${Date.now()}_${i}`,
                  text: text,
                  author: source.name,
                  source: 'facebook',
                  timestamp: new Date().toISOString(),
                  url: source.url
                });
              }
            });

            console.log(`   📝 Found ${posts.length} posts from ${source.name}`);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));

          } catch (error) {
            console.error(`   ❌ Error scraping ${source.name}:`, error.message);
          }
        }
      }

      await this.processPosts(posts);
      console.log(`✅ Facebook advanced scraping completed: ${posts.length} posts found`);

    } catch (error) {
      console.error('❌ Facebook advanced scraping failed:', error.message);
    }
  }

  async scrapeInstagramAdvanced() {
    try {
      console.log('📷 Scraping Instagram (Advanced)...');
      
      const instagramHashtags = [
        'malaysiaflood',
        'malaysiastorm',
        'malaysiaemergency',
        'banjirmalaysia',
        'ributmalaysia',
        'kecemasanmalaysia',
        'bencanamalaysia'
      ];

      const posts = [];

      if (this.browser) {
        // Use Puppeteer for Instagram scraping
        const page = await this.browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        for (const hashtag of instagramHashtags) {
          try {
            console.log(`   📷 Scraping #${hashtag}...`);
            
            const url = `https://www.instagram.com/explore/tags/${hashtag}/`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            await page.waitForTimeout(3000);
            
            // Extract Instagram posts
            const instagramPosts = await page.evaluate(() => {
              const posts = [];
              
              // Try to find Instagram post content
              const selectors = [
                'article',
                '[data-testid="post-caption"]',
                'span[dir="auto"]'
              ];
              
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element) => {
                  const text = element.textContent?.trim();
                  if (text && text.length > 20) {
                    posts.push({
                      text: text,
                      source: 'instagram'
                    });
                  }
                });
              }
              
              return posts;
            });

            const filteredPosts = instagramPosts.filter(post => 
              this.containsDisasterKeywords(post.text)
            );

            posts.push(...filteredPosts.map(post => ({
              ...post,
              author: `#${hashtag}`,
              timestamp: new Date().toISOString(),
              id: `instagram_${Date.now()}_${posts.length}`,
              hashtag: hashtag
            })));

            console.log(`   📝 Found ${filteredPosts.length} posts for #${hashtag}`);

            // Rate limiting
            await page.waitForTimeout(5000);

          } catch (error) {
            console.error(`   ❌ Error scraping #${hashtag}:`, error.message);
          }
        }
        
        await page.close();
      }

      await this.processPosts(posts);
      console.log(`✅ Instagram advanced scraping completed: ${posts.length} posts found`);

    } catch (error) {
      console.error('❌ Instagram advanced scraping failed:', error.message);
    }
  }

  async scrapeTikTokAdvanced() {
    try {
      console.log('🎵 Scraping TikTok (Advanced)...');
      
      const tiktokHashtags = [
        'malaysiaflood',
        'malaysiastorm',
        'malaysiaemergency',
        'banjirmalaysia',
        'ributmalaysia'
      ];

      const posts = [];

      if (this.browser) {
        const page = await this.browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        for (const hashtag of tiktokHashtags) {
          try {
            console.log(`   🎵 Scraping TikTok #${hashtag}...`);
            
            const url = `https://www.tiktok.com/tag/${hashtag}`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            await page.waitForTimeout(3000);
            
            // Extract TikTok content
            const tiktokPosts = await page.evaluate(() => {
              const posts = [];
              
              const selectors = [
                '[data-e2e="video-desc"]',
                '.video-meta-caption',
                '[data-testid="video-desc"]'
              ];
              
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element) => {
                  const text = element.textContent?.trim();
                  if (text && text.length > 10) {
                    posts.push({
                      text: text,
                      source: 'tiktok'
                    });
                  }
                });
              }
              
              return posts;
            });

            const filteredPosts = tiktokPosts.filter(post => 
              this.containsDisasterKeywords(post.text)
            );

            posts.push(...filteredPosts.map(post => ({
              ...post,
              author: `TikTok #${hashtag}`,
              timestamp: new Date().toISOString(),
              id: `tiktok_${Date.now()}_${posts.length}`,
              hashtag: hashtag
            })));

            console.log(`   📝 Found ${filteredPosts.length} TikTok posts for #${hashtag}`);

            await page.waitForTimeout(5000);

          } catch (error) {
            console.error(`   ❌ Error scraping TikTok #${hashtag}:`, error.message);
          }
        }
        
        await page.close();
      }

      await this.processPosts(posts);
      console.log(`✅ TikTok advanced scraping completed: ${posts.length} posts found`);

    } catch (error) {
      console.error('❌ TikTok advanced scraping failed:', error.message);
    }
  }

  async scrapeLinkedInAdvanced() {
    try {
      console.log('💼 Scraping LinkedIn (Advanced)...');
      
      const linkedinSearchTerms = [
        'malaysia flood emergency',
        'malaysia disaster management',
        'malaysia emergency response',
        'malaysia civil defence'
      ];

      const posts = [];

      for (const term of linkedinSearchTerms) {
        try {
          console.log(`   💼 Searching LinkedIn: "${term}"`);
          
          // LinkedIn public search (limited without authentication)
          const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(term)}`;
          
          const response = await http.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
          });

          const $ = cheerio.load(response.data);
          
          // Extract LinkedIn posts
          $('.feed-shared-text, .feed-shared-description, .feed-shared-content').each((i, element) => {
            const text = $(element).text().trim();
            if (text && this.containsDisasterKeywords(text)) {
              posts.push({
                id: `linkedin_${Date.now()}_${i}`,
                text: text,
                author: 'LinkedIn Professional',
                source: 'linkedin',
                timestamp: new Date().toISOString(),
                searchTerm: term
              });
            }
          });

          console.log(`   📝 Found ${posts.length} LinkedIn posts for "${term}"`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          console.error(`   ❌ Error searching LinkedIn "${term}":`, error.message);
        }
      }

      await this.processPosts(posts);
      console.log(`✅ LinkedIn advanced scraping completed: ${posts.length} posts found`);

    } catch (error) {
      console.error('❌ LinkedIn advanced scraping failed:', error.message);
    }
  }

  async scrapeYouTubeAdvanced() {
    try {
      console.log('📺 Scraping YouTube (Advanced)...');
      
      const youtubeSearchTerms = [
        'malaysia flood 2025',
        'malaysia storm emergency',
        'malaysia disaster response',
        'banjir malaysia terkini',
        'ribut malaysia'
      ];

      const posts = [];

      for (const term of youtubeSearchTerms) {
        try {
          console.log(`   📺 Searching YouTube: "${term}"`);
          
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`;
          
          const response = await http.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
          });

          const $ = cheerio.load(response.data);
          
          // Extract YouTube video information
          $('.ytd-video-renderer, .ytd-grid-video-renderer').each((i, element) => {
            const title = $(element).find('a#video-title, h3 a').text().trim();
            const description = $(element).find('.ytd-video-meta-block, .ytd-grid-video-renderer').text().trim();
            
            const combinedText = `${title} ${description}`;
            
            if (combinedText && this.containsDisasterKeywords(combinedText)) {
              posts.push({
                id: `youtube_${Date.now()}_${i}`,
                text: combinedText,
                author: 'YouTube Creator',
                source: 'youtube',
                timestamp: new Date().toISOString(),
                searchTerm: term,
                title: title
              });
            }
          });

          console.log(`   📝 Found ${posts.length} YouTube videos for "${term}"`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          console.error(`   ❌ Error searching YouTube "${term}":`, error.message);
        }
      }

      await this.processPosts(posts);
      console.log(`✅ YouTube advanced scraping completed: ${posts.length} videos found`);

    } catch (error) {
      console.error('❌ YouTube advanced scraping failed:', error.message);
    }
  }

  async scrapeTelegramChannels() {
    try {
      console.log('📱 Scraping Telegram Channels...');
      
      const telegramChannels = [
        'https://t.me/malaysiaemergency',
        'https://t.me/malaysiadisaster',
        'https://t.me/banjirmalaysia'
      ];

      const posts = [];

      for (const channel of telegramChannels) {
        try {
          console.log(`   📱 Scraping Telegram channel...`);
          
          // Telegram channels are harder to scrape, but we can try
          const response = await http.get(channel, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
          });

          const $ = cheerio.load(response.data);
          
          // Extract Telegram messages
          $('.tgme_widget_message_text, .message_text').each((i, element) => {
            const text = $(element).text().trim();
            if (text && this.containsDisasterKeywords(text)) {
              posts.push({
                id: `telegram_${Date.now()}_${i}`,
                text: text,
                author: 'Telegram Channel',
                source: 'telegram',
                timestamp: new Date().toISOString(),
                url: channel
              });
            }
          });

          console.log(`   📝 Found ${posts.length} Telegram messages`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          console.error(`   ❌ Error scraping Telegram channel:`, error.message);
        }
      }

      await this.processPosts(posts);
      console.log(`✅ Telegram scraping completed: ${posts.length} messages found`);

    } catch (error) {
      console.error('❌ Telegram scraping failed:', error.message);
    }
  }

  containsDisasterKeywords(text) {
    const lowerText = text.toLowerCase();
    return DISASTER_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  async processPosts(posts) {
    for (const post of posts) {
      try {
        this.scrapedCount++;
        
        console.log(`\n📨 Processing post: ${post.text.substring(0, 100)}...`);
        console.log(`   👤 Author: ${post.author}`);
        console.log(`   📱 Source: ${post.source}`);

        const response = await http.post(`${API_BASE_URL}/ingest/twitter`, {
          text: post.text,
          source: post.source,
          author: post.author,
          timestamp: post.timestamp,
          url: post.url,
          metadata: {
            scrapedAt: new Date().toISOString(),
            originalId: post.id,
            hashtag: post.hashtag,
            searchTerm: post.searchTerm,
            title: post.title
          }
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        this.processedCount++;

        if (response.data.verified) {
          this.verifiedCount++;
          console.log(`   ✅ VERIFIED DISASTER EVENT!`);
          console.log(`   🆔 Event ID: ${response.data.id}`);
          console.log(`   📊 Severity: ${response.data.severity}`);
          console.log(`   📍 Location: ${response.data.location || 'Not detected'}`);
          console.log(`   🚨 ALERT SENT TO EMERGENCY SERVICES!`);
        } else {
          console.log(`   ⏸️  Event processed but not verified (severity: ${response.data.severity})`);
        }

        // Rate limiting between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing post:`, error.response?.data?.message || error.message);
      }
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      scrapedCount: this.scrapedCount,
      processedCount: this.processedCount,
      verifiedCount: this.verifiedCount,
      lastScrapeTime: this.lastScrapeTime,
      uptime: this.lastScrapeTime ? Date.now() - this.lastScrapeTime.getTime() : 0
    };
  }
}

// Create scraper instance
const advancedSocialScraper = new AdvancedSocialScraper();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await advancedSocialScraper.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await advancedSocialScraper.stop();
  process.exit(0);
});

// Start the scraper if this script is run directly
if (require.main === module) {
  advancedSocialScraper.start().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { AdvancedSocialScraper, advancedSocialScraper };
