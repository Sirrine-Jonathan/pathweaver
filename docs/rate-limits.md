---
description: Understand Groq API rate limits, headers, and best practices for managing request and token quotas in your applications.
title: Rate Limits - GroqDocs
image: https://console.groq.com/og_cloudv5.jpg
---

# Rate Limits

Rate limits act as control measures to regulate how frequently users and applications can access our API within specified timeframes. These limits help ensure service stability, fair access, and protection against misuse so that we can serve reliable and fast inference for all.

## [Understanding Rate Limits](#understanding-rate-limits)

Rate limits are measured in:

- **RPM:** Requests per minute
- **RPD:** Requests per day
- **TPM:** Tokens per minute
- **TPD:** Tokens per day
- **ASH:** Audio seconds per hour
- **ASD:** Audio seconds per day

[Cached tokens](https://console.groq.com/docs/prompt-caching) do not count towards your rate limits.

Rate limits apply at the organization level, not individual users. You can hit any limit type depending on which threshold you reach first.

**Example:** Let's say your RPM = 50 and your TPM = 200K. If you were to send 50 requests with only 100 tokens within a minute, you would reach your limit even though you did not send 200K tokens within those 50 requests.

## [Rate Limits](#rate-limits)

The following is a high level summary and there may be exceptions to these limits. You can view the current, exact rate limits for your organization on the [limits page](https://console.groq.com/settings/limits) in your account settings.

FreeDeveloper

| MODEL ID                                      | RPM | RPD   | TPM  | TPD  | ASH  | ASD   |
| --------------------------------------------- | --- | ----- | ---- | ---- | ---- | ----- |
| allam-2-7b                                    | 30  | 7K    | 6K   | 500K | \-   | \-    |
| groq/compound                                 | 30  | 250   | 70K  | \-   | \-   | \-    |
| groq/compound-mini                            | 30  | 250   | 70K  | \-   | \-   | \-    |
| llama-3.1-8b-instant                          | 30  | 14.4K | 6K   | 500K | \-   | \-    |
| llama-3.3-70b-versatile                       | 30  | 1K    | 12K  | 100K | \-   | \-    |
| meta-llama/llama-4-maverick-17b-128e-instruct | 30  | 1K    | 6K   | 500K | \-   | \-    |
| meta-llama/llama-4-scout-17b-16e-instruct     | 30  | 1K    | 30K  | 500K | \-   | \-    |
| meta-llama/llama-guard-4-12b                  | 30  | 14.4K | 15K  | 500K | \-   | \-    |
| meta-llama/llama-prompt-guard-2-22m           | 30  | 14.4K | 15K  | 500K | \-   | \-    |
| meta-llama/llama-prompt-guard-2-86m           | 30  | 14.4K | 15K  | 500K | \-   | \-    |
| moonshotai/kimi-k2-instruct                   | 60  | 1K    | 10K  | 300K | \-   | \-    |
| moonshotai/kimi-k2-instruct-0905              | 60  | 1K    | 10K  | 300K | \-   | \-    |
| openai/gpt-oss-120b                           | 30  | 1K    | 8K   | 200K | \-   | \-    |
| openai/gpt-oss-20b                            | 30  | 1K    | 8K   | 200K | \-   | \-    |
| playai-tts                                    | 10  | 100   | 1.2K | 3.6K | \-   | \-    |
| playai-tts-arabic                             | 10  | 100   | 1.2K | 3.6K | \-   | \-    |
| qwen/qwen3-32b                                | 60  | 1K    | 6K   | 500K | \-   | \-    |
| whisper-large-v3                              | 20  | 2K    | \-   | \-   | 7.2K | 28.8K |
| whisper-large-v3-turbo                        | 20  | 2K    | \-   | \-   | 7.2K | 28.8K |

| MODEL ID                                      | RPM | RPD  | TPM  | TPD | ASH  | ASD |
| --------------------------------------------- | --- | ---- | ---- | --- | ---- | --- |
| allam-2-7b                                    | 300 | 60K  | 60K  | \-  | \-   | \-  |
| groq/compound                                 | 200 | 20K  | 200K | \-  | \-   | \-  |
| groq/compound-mini                            | 200 | 20K  | 200K | \-  | \-   | \-  |
| llama-3.1-8b-instant                          | 1K  | 500K | 250K | \-  | \-   | \-  |
| llama-3.3-70b-versatile                       | 1K  | 500K | 300K | \-  | \-   | \-  |
| meta-llama/llama-4-maverick-17b-128e-instruct | 1K  | 500K | 300K | \-  | \-   | \-  |
| meta-llama/llama-4-scout-17b-16e-instruct     | 1K  | 500K | 300K | \-  | \-   | \-  |
| meta-llama/llama-guard-4-12b                  | 100 | 50K  | 30K  | 1M  | \-   | \-  |
| meta-llama/llama-prompt-guard-2-22m           | 100 | 50K  | 30K  | \-  | \-   | \-  |
| meta-llama/llama-prompt-guard-2-86m           | 100 | 50K  | 30K  | \-  | \-   | \-  |
| moonshotai/kimi-k2-instruct                   | 1K  | 500K | 250K | \-  | \-   | \-  |
| moonshotai/kimi-k2-instruct-0905              | 1K  | 500K | 250K | \-  | \-   | \-  |
| openai/gpt-oss-120b                           | 1K  | 500K | 250K | \-  | \-   | \-  |
| openai/gpt-oss-20b                            | 1K  | 500K | 250K | \-  | \-   | \-  |
| playai-tts                                    | 250 | 100K | 50K  | 2M  | \-   | \-  |
| playai-tts-arabic                             | 250 | 100K | 50K  | 2M  | \-   | \-  |
| qwen/qwen3-32b                                | 1K  | 500K | 300K | \-  | \-   | \-  |
| whisper-large-v3                              | 300 | 200K | \-   | \-  | 200K | 4M  |
| whisper-large-v3-turbo                        | 400 | 200K | \-   | \-  | 400K | 4M  |

## [Rate Limit Headers](#rate-limit-headers)

In addition to viewing your limits on your account's [limits](https://console.groq.com/settings/limits) page, you can also view rate limit information such as remaining requests and tokens in HTTP response headers as follows:

The following headers are set (values are illustrative):

| Header                         | Value    | Notes                                    |
| ------------------------------ | -------- | ---------------------------------------- |
| retry-after                    | 2        | In seconds                               |
| x-ratelimit-limit-requests     | 14400    | Always refers to Requests Per Day (RPD)  |
| x-ratelimit-limit-tokens       | 18000    | Always refers to Tokens Per Minute (TPM) |
| x-ratelimit-remaining-requests | 14370    | Always refers to Requests Per Day (RPD)  |
| x-ratelimit-remaining-tokens   | 17997    | Always refers to Tokens Per Minute (TPM) |
| x-ratelimit-reset-requests     | 2m59.56s | Always refers to Requests Per Day (RPD)  |
| x-ratelimit-reset-tokens       | 7.66s    | Always refers to Tokens Per Minute (TPM) |

## [Handling Rate Limits](#handling-rate-limits)

When you exceed rate limits, our API returns a `429 Too Many Requests` HTTP status code.

**Note**: `retry-after` is only set if you hit the rate limit and status code 429 is returned. The other headers are always included.

## [Need Higher Rate Limits?](#need-higher-rate-limits)

If you need higher rate limits, you can [request them here](https://groq.com/self-serve-support).
