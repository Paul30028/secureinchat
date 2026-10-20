# Reddit drafts (to be posted by Paul; do not post before the subreddit's current rules and moderators allow it)

## 1. Modmail to r/privacy moderators
Subject: Question about posting a technical write-up of an open-source DNS leak test

Hi mods,

I maintain a small open-source privacy toolkit and I would like to post a technical write-up of how its DNS leak test works (it uses an authoritative DNS server I run), including its limitations. The post would link to the source and the live test. I am the author.

Is a post like this allowed here, and if so is there a preferred format, flair or weekly thread I should use? If self-promotion is not allowed, I will not post it. Thank you.

## 2. Post (use only if the mods agree)
Title: How a DNS leak test can work with an authoritative server, and what it cannot prove

Body:
I run a small open-source set of browser privacy tools. One of them is a DNS leak test, and I want to describe how it works and where it is weak, because I would like criticism more than traffic.

How it works
- The page asks your browser to look up six random names under a zone that I run an authoritative DNS server for. The names are unique per run, so nothing is answered from a cache.
- My server sees which resolver asked for each name. It does not see your device.
- The page then reads the list of resolver addresses back and looks up which network each belongs to (ASN).
- It compares those networks with the network of your exit IP. Resolvers on the same network as the exit look like a VPN or proxy resolver. A well-known public resolver such as Google or Cloudflare gets an informational result. A resolver that also answered when you ran the test without the VPN is flagged as a likely leak. For that comparison the page keeps the first run in memory in your tab.
- Resolver addresses are held in memory on the server for ten minutes and are not written to disk or to logs.

What it cannot show
- The server sees the recursive resolver, not you. If your browser uses DNS over HTTPS, you will see that provider.
- A different network is normal when a VPN uses its own resolvers elsewhere, so only the with/without comparison counts as a clear failure.
- It runs on a single server, I have not benchmarked it across many browsers and VPNs, and I am not claiming it is more accurate than existing tests.
- My CDN still sees your IP when you load the page, like any website.

Source: https://github.com/Paul30028/secureinchat
Test: https://secureinchat.com/tools/ip-leak-test/
(Disclosure: this is my own project.)

Questions I would like help with: how do you tell a failed test from a query that never reached the server, and which edge cases around resolver caching have you hit?
