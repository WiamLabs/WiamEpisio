# WiamEpisio Complete Inventory Appendix

Generated for Step 1 full audit. Do not treat as runtime API docs — source of truth is code.

## A. Every ORM model

Count: **130**

1. `User`
2. `VerificationCode`
3. `Content`
4. `Genre`
5. `Favorite`
6. `Access`
7. `Order`
8. `FeaturedBook`
9. `CreatorProfile`
10. `Follow`
11. `Rating`
12. `CommissionSettings`
13. `PlatformFeeSettings`
14. `WebSession`
15. `Review`
16. `ReviewLike`
17. `WebBookContent`
18. `ReadingProgress`
19. `ChapterComment`
20. `ChapterCommentLike`
21. `ChapterLike`
22. `ChapterVote`
23. `ParagraphReaction`
24. `ParagraphComment`
25. `ParagraphCommentLike`
26. `ReaderPreferences`
27. `Announcement`
28. `Notification`
29. `PushSubscription`
30. `ExpoPushToken`
31. `TrialDeviceFingerprint`
32. `EmailJob`
33. `ReadingStreak`
34. `Bookmark`
35. `Shelf`
36. `ShelfItem`
37. `UserLibrary`
38. `BookCollection`
39. `CollectionItem`
40. `SectionSettings`
41. `BookSection`
42. `ShareEvent`
43. `StickerGift`
44. `GiftBook`
45. `PlatformConfig`
46. `CoinBalance`
47. `CoinTransaction`
48. `CoinPackage`
49. `PremiumCreditsLedger`
50. `ChapterUnlock`
51. `PremiumReferral`
52. `MonetizationStatus`
53. `CreatorEarnings`
54. `CreatorPayout`
55. `CreatorPayoutSettings`
56. `CreatorWithdrawal`
57. `CreatorSubTier`
58. `CreatorSubscription`
59. `CreatorSubEarning`
60. `ReadingList`
61. `ReadingListItem`
62. `RevenueRule`
63. `LedgerEntry`
64. `SystemWallet`
65. `RefundRequest`
66. `FraudAlert`
67. `Report`
68. `TeamCompPlan`
69. `BannedWord`
70. `ContentReport`
71. `ContentFlag`
72. `ModerationLog`
73. `EliteStory`
74. `EliteSubscription`
75. `EliteReadLog`
76. `PremiumSubscription`
77. `TeamPayroll`
78. `TeamPayrollSettings`
79. `StoryChallenge`
80. `ChallengeEntry`
81. `GiftSubscription`
82. `CreatorMilestone`
83. `ReaderBadge`
84. `Referral`
85. `BulletinPost`
86. `BulletinFollow`
87. `BulletinReaction`
88. `ApplicationForm`
89. `ApplicationResponse`
90. `TeamIdHistory`
91. `Feedback`
92. `UserWarning`
93. `UserGenrePreference`
94. `ImageStore`
95. `BotUnmatchedMessage`
96. `ApexSubmission`
97. `EditorialNote`
98. `ReviewQueue`
99. `AuditLog`
100. `Role`
101. `Permission`
102. `RolePermission`
103. `UserRole`
104. `ClassicBook`
105. `ClassicChapter`
106. `ClassicFetchLog`
107. `PlatformSetting`
108. `MagicBox`
109. `MagicBoxReward`
110. `AdImpression`
111. `FeatureFlag`
112. `VoiceStory`
113. `VoiceMoment`
114. `VoiceMomentLike`
115. `VoiceMomentComment`
116. `VoiceStorySave`
117. `VoiceStoryUnlock`
118. `VoiceListenDayBucket`
119. `VoiceListenProgress`
120. `VoiceListenPresence`
121. `VoiceStoryRoomMessage`
122. `BookPopularityScore`
123. `AnalyticsEvent`
124. `Universe`
125. `Series`
126. `SeriesContent`
127. `Arc`
128. `StudioProSubscription`
129. `CreatorSettings`
130. `AISuggestion`

## B. Every Flask route (all blueprints)

Count: **611**

### `founder.py` (143 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 42 | `founder_bp` | `'/'` | `overview` |
| 100 | `founder_bp` | `'/users'` | `users` |
| 127 | `founder_bp` | `'/users/<int:user_id>/role', methods=['POST']` | `change_role` |
| 161 | `founder_bp` | `'/users/<int:user_id>/ban', methods=['POST']` | `toggle_ban` |
| 184 | `founder_bp` | `'/content'` | `content` |
| 210 | `founder_bp` | `'/content/<int:book_id>/feature', methods=['POST']` | `toggle_feature` |
| 226 | `founder_bp` | `'/content/<int:book_id>/approve', methods=['POST']` | `approve_book` |
| 247 | `founder_bp` | `'/content/<int:book_id>/reject', methods=['POST']` | `reject_book` |
| 268 | `founder_bp` | `'/content/<int:book_id>/publish', methods=['POST']` | `publish_book` |
| 283 | `founder_bp` | `'/content/<int:book_id>/delete', methods=['POST']` | `delete_book` |
| 295 | `founder_bp` | `'/coin-purchases'` | `coin_purchases` |
| 327 | `founder_bp` | `'/orders'` | `orders` |
| 333 | `founder_bp` | `'/revenue'` | `revenue` |
| 424 | `founder_bp` | `'/revenue/update-rule', methods=['POST']` | `update_revenue_rule` |
| 448 | `founder_bp` | `'/revenue/add-rule', methods=['POST']` | `add_revenue_rule` |
| 473 | `founder_bp` | `'/revenue/delete-rule/<int:rule_id>', methods=['POST']` | `delete_revenue_rule` |
| 490 | `founder_bp` | `'/payouts/<int:payout_id>/approve', methods=['POST']` | `approve_payout` |
| 525 | `founder_bp` | `'/payouts/<int:payout_id>/reject', methods=['POST']` | `reject_payout` |
| 547 | `founder_bp` | `'/genres'` | `genres` |
| 555 | `founder_bp` | `'/genres/add', methods=['POST']` | `add_genre` |
| 573 | `founder_bp` | `'/genres/<int:genre_id>/delete', methods=['POST']` | `delete_genre` |
| 600 | `founder_bp` | `'/book-sections'` | `book_sections` |
| 612 | `founder_bp` | `'/book-sections/add', methods=['POST']` | `add_book_section` |
| 642 | `founder_bp` | `'/book-sections/<int:sec_id>/edit', methods=['POST']` | `edit_book_section` |
| 668 | `founder_bp` | `'/book-sections/<int:sec_id>/toggle', methods=['POST']` | `toggle_book_section` |
| 680 | `founder_bp` | `'/book-sections/<int:sec_id>/delete', methods=['POST']` | `delete_book_section` |
| 692 | `founder_bp` | `'/creators'` | `creators` |
| 744 | `founder_bp` | `'/ai-status'` | `ai_status` |
| 824 | `founder_bp` | `'/analytics/content'` | `analytics_content` |
| 832 | `founder_bp` | `'/analytics/users'` | `analytics_users` |
| 864 | `founder_bp` | `'/analytics/platform'` | `analytics_platform` |
| 872 | `founder_bp` | `'/ai-content-review'` | `ai_content_review` |
| 904 | `founder_bp` | `'/creators/<int:user_id>/approve', methods=['POST']` | `approve_creator` |
| 924 | `founder_bp` | `'/creators/<int:user_id>/reject', methods=['POST']` | `reject_creator` |
| 945 | `founder_bp` | `'/settings'` | `settings` |
| 1023 | `founder_bp` | `'/settings/test-email', methods=['POST']` | `test_email` |
| 1219 | `founder_bp` | `'/settings/platform-config', methods=['POST']` | `update_platform_config` |
| 1282 | `founder_bp` | `'/settings/feature-flag', methods=['POST']` | `toggle_feature_flag` |
| 1308 | `founder_bp` | `'/settings/feature-lock', methods=['POST']` | `toggle_feature_lock` |
| 1342 | `founder_bp` | `'/settings/coin-package', methods=['POST']` | `update_coin_package` |
| 1378 | `founder_bp` | `'/settings/section-toggle', methods=['POST']` | `toggle_section` |
| 1408 | `founder_bp` | `'/admins'` | `admins` |
| 1424 | `founder_bp` | `'/admins/add', methods=['POST']` | `add_admin` |
| 1464 | `founder_bp` | `'/admins/<int:user_id>/remove', methods=['POST']` | `remove_admin` |
| 1490 | `founder_bp` | `'/announcements'` | `announcements` |
| 1498 | `founder_bp` | `'/announcements/create', methods=['POST']` | `create_announcement` |
| 1560 | `founder_bp` | `'/announcements/<int:ann_id>/toggle', methods=['POST']` | `toggle_announcement` |
| 1571 | `founder_bp` | `'/announcements/<int:ann_id>/delete', methods=['POST']` | `delete_announcement` |
| 1586 | `founder_bp` | `'/collections'` | `collections` |
| 1598 | `founder_bp` | `'/collections/create', methods=['POST']` | `create_collection` |
| 1614 | `founder_bp` | `'/collections/<int:coll_id>'` | `collection_detail` |
| 1632 | `founder_bp` | `'/collections/<int:coll_id>/add', methods=['POST']` | `add_to_collection` |
| 1647 | `founder_bp` | `'/collections/<int:coll_id>/remove/<int:item_id>', methods=['POST']` | `remove_from_collection` |
| 1658 | `founder_bp` | `'/collections/<int:coll_id>/toggle', methods=['POST']` | `toggle_collection` |
| 1669 | `founder_bp` | `'/collections/<int:coll_id>/delete', methods=['POST']` | `delete_collection` |
| 1685 | `founder_bp` | `'/moderation'` | `moderation` |
| 1730 | `founder_bp` | `'/moderation/action', methods=['POST']` | `moderation_action` |
| 1752 | `founder_bp` | `'/moderation/report/<int:report_id>/dismiss', methods=['POST']` | `dismiss_report` |
| 1792 | `founder_bp` | `'/warnings'` | `warnings_list` |
| 1826 | `founder_bp` | `'/warnings/issue', methods=['POST']` | `issue_warning` |
| 1895 | `founder_bp` | `'/warnings/<int:warning_id>/delete', methods=['POST']` | `delete_warning` |
| 1907 | `founder_bp` | `'/disputes'` | `disputes` |
| 1932 | `founder_bp` | `'/disputes/<int:report_id>/assign', methods=['POST']` | `assign_dispute` |
| 1945 | `founder_bp` | `'/disputes/<int:report_id>/resolve', methods=['POST']` | `resolve_dispute` |
| 1968 | `founder_bp` | `'/disputes/<int:report_id>/dismiss', methods=['POST']` | `dismiss_dispute` |
| 1983 | `founder_bp` | `'/moderation/banned-words'` | `banned_words` |
| 1992 | `founder_bp` | `'/moderation/banned-words/add', methods=['POST']` | `add_banned_word` |
| 2016 | `founder_bp` | `'/moderation/banned-words/<int:word_id>/delete', methods=['POST']` | `delete_banned_word` |
| 2028 | `founder_bp` | `'/moderation/seed-words', methods=['POST']` | `seed_words` |
| 2040 | `founder_bp` | `'/elite'` | `elite_manage` |
| 2074 | `founder_bp` | `'/elite/run-algorithm', methods=['POST']` | `elite_run_algorithm` |
| 2084 | `founder_bp` | `'/elite/demote/<int:content_id>', methods=['POST']` | `elite_demote` |
| 2095 | `founder_bp` | `'/elite/promote/<int:content_id>', methods=['POST']` | `elite_promote` |
| 2196 | `founder_bp` | `'/forms'` | `forms_dashboard` |
| 2223 | `founder_bp` | `'/forms/seed', methods=['POST']` | `seed_forms` |
| 2240 | `founder_bp` | `'/forms/<int:form_id>/responses'` | `form_responses` |
| 2270 | `founder_bp` | `'/forms/<int:form_id>/send', methods=['POST']` | `send_form_invite` |
| 2313 | `founder_bp` | `'/forms/response/<int:resp_id>/review', methods=['POST']` | `review_response` |
| 2347 | `founder_bp` | `'/forms/response/<int:resp_id>/create-account', methods=['POST']` | `create_team_account` |
| 2443 | `founder_bp` | `'/team/rotate-id/<int:user_id>', methods=['POST']` | `rotate_team_id` |
| 2487 | `founder_bp` | `'/forms/response/<int:resp_id>/delete', methods=['POST']` | `delete_form_response` |
| 2504 | `founder_bp` | `'/run-eligibility-check', methods=['POST']` | `run_eligibility_check` |
| 2518 | `founder_bp` | `'/payouts'` | `payouts` |
| 2556 | `founder_bp` | `'/run-payouts', methods=['POST']` | `run_payouts` |
| 2571 | `founder_bp` | `'/retry-payout/<int:payout_id>', methods=['POST']` | `retry_payout` |
| 2588 | `founder_bp` | `'/team'` | `team_management` |
| 2638 | `founder_bp` | `'/team/<int:user_id>/assign-role', methods=['POST']` | `team_assign_role` |
| 2690 | `founder_bp` | `'/team/<int:user_id>/remove-role', methods=['POST']` | `team_remove_role` |
| 2719 | `founder_bp` | `'/team/add-member', methods=['POST']` | `team_add_member` |
| 2752 | `founder_bp` | `'/team/create-account', methods=['POST']` | `team_create_account` |
| 2843 | `founder_bp` | `'/team/<int:user_id>/reset-password', methods=['POST']` | `team_reset_password` |
| 2881 | `founder_bp` | `'/team/<int:user_id>/deactivate', methods=['POST']` | `team_deactivate` |
| 2897 | `founder_bp` | `'/team/<int:user_id>/reactivate', methods=['POST']` | `team_reactivate` |
| 2910 | `founder_bp` | `'/team/comp-plans'` | `team_comp_plans` |
| 2920 | `founder_bp` | `'/team/comp-plans/add', methods=['POST']` | `add_comp_plan` |
| 2943 | `founder_bp` | `'/team/comp-plans/<int:plan_id>/update', methods=['POST']` | `update_comp_plan` |
| 2960 | `founder_bp` | `'/team/comp-plans/<int:plan_id>/toggle', methods=['POST']` | `toggle_comp_plan` |
| 2972 | `founder_bp` | `'/team/<int:user_id>/ban', methods=['POST']` | `team_ban` |
| 2988 | `founder_bp` | `'/team/<int:user_id>/unban', methods=['POST']` | `team_unban` |
| 3005 | `founder_bp` | `'/accounts'` | `account_management` |
| 3015 | `founder_bp` | `'/accounts/<int:user_id>/reactivate', methods=['POST']` | `account_reactivate` |
| 3030 | `founder_bp` | `'/accounts/<int:user_id>/delete', methods=['POST']` | `account_complete_delete` |
| 3053 | `founder_bp` | `'/accounts/delete-by-email', methods=['POST']` | `account_delete_by_email` |
| 3087 | `founder_bp` | `'/feedback'` | `feedback_list` |
| 3102 | `founder_bp` | `'/feedback/<int:fb_id>/status', methods=['POST']` | `feedback_status` |
| 3116 | `founder_bp` | `'/feedback/<int:fb_id>/reply', methods=['POST']` | `reply_feedback` |
| 3151 | `founder_bp` | `'/feedback/<int:fb_id>/delete', methods=['POST']` | `delete_feedback` |
| 3169 | `founder_bp` | `'/premium/grant-credits', methods=['POST']` | `grant_credits` |
| 3198 | `founder_bp` | `'/review-queue'` | `review_queue` |
| 3230 | `founder_bp` | `'/review-queue/<int:queue_id>/override', methods=['POST']` | `review_override` |
| 3280 | `founder_bp` | `'/review-queue/<int:queue_id>/rerun-bot', methods=['POST']` | `rerun_bot_review` |
| 3299 | `founder_bp` | `'/settings/platform'` | `platform_settings` |
| 3310 | `founder_bp` | `'/settings/platform/save', methods=['POST']` | `save_platform_settings` |
| 3353 | `founder_bp` | `'/settings/ads/save', methods=['POST']` | `save_ads_settings` |
| 3389 | `founder_bp` | `'/settings/auth-gate/save', methods=['POST']` | `save_auth_gate` |
| 3457 | `founder_bp` | `'/email-studio'` | `email_studio` |
| 3483 | `founder_bp` | `'/email-studio/send', methods=['POST']` | `email_studio_send` |
| 3592 | `founder_bp` | `'/email-studio/preview', methods=['POST']` | `email_studio_preview` |
| 3623 | `founder_bp` | `'/email-studio/search-users'` | `email_studio_search_users` |
| 3658 | `founder_bp` | `'/settings/flags/toggle', methods=['POST']` | `toggle_platform_flag` |
| 3693 | `founder_bp` | `'/subscribers'` | `subscribers` |
| 3759 | `founder_bp` | `'/payroll'` | `payroll` |
| 3810 | `founder_bp` | `'/payroll/add-worker', methods=['POST']` | `payroll_add_worker` |
| 3854 | `founder_bp` | `'/payroll/toggle-worker/<int:user_id>', methods=['POST']` | `payroll_toggle_worker` |
| 3873 | `founder_bp` | `'/payroll/remove-worker/<int:user_id>', methods=['POST']` | `payroll_remove_worker` |
| 3885 | `founder_bp` | `'/payroll/create-recipient/<int:user_id>', methods=['POST']` | `payroll_create_recipient` |
| 3903 | `founder_bp` | `'/payroll/generate', methods=['POST']` | `payroll_generate` |
| 3917 | `founder_bp` | `'/payroll/run', methods=['POST']` | `payroll_run` |
| 3931 | `founder_bp` | `'/payroll/retry/<int:payroll_id>', methods=['POST']` | `payroll_retry` |
| 3953 | `founder_bp` | `'/settings/manage-founder', methods=['POST']` | `manage_founder_account` |
| 4014 | `founder_bp` | `'/notifications'` | `notification_testing` |
| 4038 | `founder_bp` | `'/notifications/test', methods=['POST']` | `send_test_notification` |
| 4117 | `founder_bp` | `'/withdrawals'` | `withdrawals` |
| 4150 | `founder_bp` | `'/financial'` | `financial_dashboard` |
| 4179 | `founder_bp` | `'/financial/freeze/<int:user_id>', methods=['POST']` | `freeze_account` |
| 4196 | `founder_bp` | `'/financial/adjust/<int:user_id>', methods=['POST']` | `adjust_balance` |
| 4220 | `founder_bp` | `'/financial/refund/<int:refund_id>', methods=['POST']` | `resolve_refund` |
| 4258 | `founder_bp` | `'/financial/alert/<int:alert_id>/resolve', methods=['POST']` | `resolve_fraud_alert` |
| 4275 | `founder_bp` | `'/premium'` | `premium_analytics` |
| 4355 | `founder_bp` | `'/premium/grant', methods=['POST']` | `premium_grant` |
| 4387 | `founder_bp` | `'/migrate-images'` | `migrate_images_page` |
| 4472 | `founder_bp` | `'/migrate-images/run', methods=['POST']` | `migrate_images_run` |
| 4556 | `founder_bp` | `'/premium/revoke', methods=['POST']` | `premium_revoke` |

### `api_v1.py` (137 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 388 | `api_v1` | `'/health'` | `health_check` |
| 393 | `api_v1` | `'/health/db'` | `health_db` |
| 409 | `api_v1` | `'/'` | `api_info` |
| 429 | `api_v1` | `'/auth/login', methods=['POST']` | `auth_login` |
| 480 | `api_v1` | `'/auth/register', methods=['POST']` | `auth_register` |
| 601 | `api_v1` | `'/auth/google', methods=['POST']` | `auth_google` |
| 721 | `api_v1` | `'/auth/forgot-password', methods=['POST']` | `auth_forgot_password` |
| 741 | `api_v1` | `'/auth/reset-password', methods=['POST']` | `auth_reset_password` |
| 773 | `api_v1` | `'/auth/me'` | `auth_me` |
| 822 | `api_v1` | `'/auth/check-username', methods=['GET']` | `check_username_availability` |
| 853 | `api_v1` | `'/auth/profile', methods=['PUT']` | `update_profile` |
| 912 | `api_v1` | `'/auth/complete-registration', methods=['POST']` | `complete_registration` |
| 924 | `api_v1` | `'/auth/avatar', methods=['POST']` | `upload_avatar` |
| 964 | `api_v1` | `'/auth/change-password', methods=['POST']` | `change_password` |
| 988 | `api_v1` | `'/auth/delete-account', methods=['POST']` | `delete_account` |
| 1049 | `api_v1` | `'/apply/submit', methods=['POST']` | `apply_creator` |
| 1120 | `api_v1` | `'/home'` | `home_feed` |
| 1320 | `api_v1` | `'/recommendations'` | `recommendations_api` |
| 1334 | `api_v1` | `'/recommendations/similar/<int:book_id>'` | `recommendations_similar` |
| 1346 | `api_v1` | `'/recommendations/genre/<genre>'` | `recommendations_genre` |
| 1362 | `api_v1` | `'/reading-lists'` | `reading_lists_index` |
| 1373 | `api_v1` | `'/reading-lists', methods=['POST']` | `reading_lists_create` |
| 1396 | `api_v1` | `'/reading-lists/<int:list_id>'` | `reading_lists_detail` |
| 1434 | `api_v1` | `'/reading-lists/<int:list_id>', methods=['PUT', 'PATCH']` | `reading_lists_update` |
| 1456 | `api_v1` | `'/reading-lists/<int:list_id>', methods=['DELETE']` | `reading_lists_delete` |
| 1471 | `api_v1` | `'/reading-lists/<int:list_id>/items', methods=['POST']` | `reading_lists_add_item` |
| 1511 | `api_v1` | `'/reading-lists/<int:list_id>/items/<int:content_id>', methods=['DELETE']` | `reading_lists_remove_item` |
| 1559 | `api_v1` | `'/books'` | `books_list` |
| 1595 | `api_v1` | `'/books/<int:book_id>'` | `book_detail` |
| 1708 | `api_v1` | `'/books/<int:book_id>/chapters/<int:ch_num>'` | `read_chapter` |
| 1842 | `api_v1` | `'/books/<int:book_id>/library/toggle', methods=['POST']` | `toggle_library_api` |
| 1863 | `api_v1` | `'/library'` | `my_library_api` |
| 1896 | `api_v1` | `'/books/<int:book_id>/tip', methods=['POST']` | `tip_creator_api` |
| 1974 | `api_v1` | `'/reader/save-position', methods=['POST']` | `save_position_api` |
| 2020 | `api_v1` | `'/reader/react', methods=['POST']` | `react_api` |
| 2065 | `api_v1` | `'/reader/reactions', methods=['GET']` | `get_reactions_api` |
| 2091 | `api_v1` | `'/reader/comment', methods=['POST']` | `add_comment_api` |
| 2185 | `api_v1` | `'/reader/comments', methods=['GET']` | `get_comments_api` |
| 2260 | `api_v1` | `'/reader/comment-counts', methods=['GET']` | `comment_counts_api` |
| 2280 | `api_v1` | `'/reader/comment/<int:comment_id>/like', methods=['POST']` | `like_comment_api` |
| 2317 | `api_v1` | `'/reader/comment/<int:comment_id>/delete', methods=['POST']` | `delete_comment_api` |
| 2342 | `api_v1` | `'/reader/comment/<int:comment_id>/report', methods=['POST']` | `report_comment_api` |
| 2382 | `api_v1` | `'/notifications', methods=['GET']` | `notifications_api` |
| 2419 | `api_v1` | `'/notifications/<int:notif_id>/read', methods=['POST']` | `notifications_mark_read_api` |
| 2433 | `api_v1` | `'/notifications/mark-all-read', methods=['POST']` | `notifications_mark_all_read_api` |
| 2446 | `api_v1` | `'/notifications/<int:notif_id>', methods=['DELETE']` | `notifications_delete_api` |
| 2460 | `api_v1` | `'/notifications/clear', methods=['DELETE']` | `notifications_clear_api` |
| 2471 | `api_v1` | `'/gifts/received', methods=['GET']` | `gifts_received_api` |
| 2521 | `api_v1` | `'/programs', methods=['GET']` | `programs_api` |
| 2589 | `api_v1` | `'/books/<int:book_id>/favorite', methods=['POST']` | `toggle_favorite` |
| 2614 | `api_v1` | `'/books/<int:book_id>/rate', methods=['POST']` | `rate_book` |
| 2650 | `api_v1` | `'/books/<int:book_id>/reviews'` | `book_reviews` |
| 2690 | `api_v1` | `'/books/<int:book_id>/reviews', methods=['POST']` | `create_review` |
| 2719 | `api_v1` | `'/books/<int:book_id>/reviews/<int:review_id>', methods=['DELETE']` | `delete_review` |
| 2733 | `api_v1` | `'/reviews/<int:review_id>/like', methods=['POST']` | `toggle_review_like` |
| 2837 | `api_v1` | `'/reader/stats'` | `reader_stats` |
| 2862 | `api_v1` | `'/reader/badges'` | `reader_badges` |
| 2889 | `api_v1` | `'/creators/<int:creator_id>'` | `creator_profile` |
| 2930 | `api_v1` | `'/creators/<int:creator_id>/follow', methods=['POST']` | `toggle_follow` |
| 2968 | `api_v1` | `'/my/following'` | `my_following` |
| 3012 | `api_v1` | `'/schedule/upcoming'` | `schedule_upcoming` |
| 3101 | `api_v1` | `'/search'` | `search` |
| 3160 | `api_v1` | `'/genres'` | `genres_list` |
| 3174 | `api_v1` | `'/genres/preferences', methods=['GET', 'POST']` | `genre_preferences` |
| 3217 | `api_v1` | `'/featured'` | `featured_books` |
| 3232 | `api_v1` | `'/trending'` | `trending_books` |
| 3247 | `api_v1` | `'/coins/balance'` | `get_coins_balance` |
| 3266 | `api_v1` | `'/coins/history'` | `get_coins_history` |
| 3301 | `api_v1` | `'/coins/packages'` | `get_coin_packages` |
| 3325 | `api_v1` | `'/coins/unlock', methods=['POST']` | `unlock_chapter_api` |
| 3408 | `api_v1` | `'/coins/initialize', methods=['POST']` | `initialize_purchase_api` |
| 3464 | `api_v1` | `'/coins/verify', methods=['POST']` | `verify_purchase_api` |
| 3524 | `api_v1` | `'/wallet/status'` | `wallet_status_api` |
| 3545 | `api_v1` | `'/wallet/refund', methods=['POST']` | `request_refund_api` |
| 3584 | `api_v1` | `'/creator/earnings'` | `creator_earnings_api` |
| 3633 | `api_v1` | `'/iap/confirm', methods=['POST']` | `iap_confirm_purchase` |
| 3694 | `api_v1` | `'/iap/confirm-subscription', methods=['POST']` | `iap_confirm_subscription` |
| 3773 | `api_v1` | `'/iap/packages'` | `iap_packages` |
| 3806 | `api_v1` | `'/rewards/welcome', methods=['POST']` | `claim_welcome_bonus_api` |
| 3818 | `api_v1` | `'/rewards/daily', methods=['POST']` | `claim_daily_reward_api` |
| 3830 | `api_v1` | `'/rewards/status'` | `rewards_status_api` |
| 3856 | `api_v1` | `'/rewards/first-mission/status'` | `first_mission_status_api` |
| 3885 | `api_v1` | `'/rewards/first-mission/claim', methods=['POST']` | `first_mission_claim_api` |
| 3920 | `api_v1` | `'/creator/dashboard'` | `creator_dashboard_api` |
| 3967 | `api_v1` | `'/creator/stories'` | `creator_stories_api` |
| 3999 | `api_v1` | `'/creator/stories/<int:book_id>/analytics'` | `creator_story_analytics_api` |
| 4120 | `api_v1` | `'/creator/followers'` | `creator_followers_api` |
| 4153 | `api_v1` | `'/studio/stories', methods=['POST']` | `studio_create_story_api` |
| 4208 | `api_v1` | `'/studio/stories/<int:book_id>'` | `studio_get_story_api` |
| 4256 | `api_v1` | `'/studio/stories/<int:book_id>/save', methods=['POST']` | `studio_save_chapter_api` |
| 4299 | `api_v1` | `'/studio/stories/<int:book_id>/chapter/add', methods=['POST']` | `studio_add_chapter_api` |
| 4335 | `api_v1` | `'/studio/stories/<int:book_id>/chapter/<int:ch_num>'` | `studio_get_chapter_api` |
| 4374 | `api_v1` | `'/studio/stories/<int:book_id>/settings', methods=['POST']` | `studio_update_settings_api` |
| 4404 | `api_v1` | `'/studio/stories/<int:book_id>/cover', methods=['POST']` | `studio_upload_cover_api` |
| 4491 | `api_v1` | `'/studio/stories/<int:book_id>/publish', methods=['POST']` | `studio_publish_story_api` |
| 4555 | `api_v1` | `'/studio/stories/<int:book_id>/chapter/<int:ch_num>/publish', methods=['POST']` | `studio_publish_chapter_api` |
| 4644 | `api_v1` | `'/studio/stories/<int:book_id>/publish-all-chapters', methods=['POST']` | `studio_publish_all_chapters_api` |
| 4707 | `api_v1` | `'/studio/stories/<int:book_id>/delete', methods=['POST']` | `studio_delete_story_api` |
| 4728 | `api_v1` | `'/studio/stories/<int:book_id>/chapter/<int:ch_num>/delete', methods=['POST']` | `studio_delete_chapter_api` |
| 4768 | `api_v1` | `'/bulletin/feed'` | `bulletin_feed_api` |
| 4926 | `api_v1` | `'/bulletin/<int:post_id>/react', methods=['POST']` | `bulletin_react_api` |
| 4962 | `api_v1` | `'/push-token', methods=['POST']` | `register_push_token` |
| 4992 | `api_v1` | `'/push-token', methods=['DELETE']` | `unregister_push_token` |
| 5020 | `api_v1` | `'/ads/impression', methods=['POST']` | `log_ad_impression` |
| 5073 | `api_v1` | `'/ads/reward-unlock', methods=['POST']` | `reward_ad_unlock` |
| 5121 | `api_v1` | `'/creator/ad-earnings'` | `creator_ad_earnings` |
| 5167 | `api_v1` | `'/premium/dev-activate', methods=['POST']` | `dev_activate_premium` |
| 5197 | `api_v1` | `'/premium/status'` | `premium_status` |
| 5230 | `api_v1` | `'/security/play-integrity/verify', methods=['POST']` | `verify_play_integrity` |
| 5271 | `api_v1` | `'/security/integrity/nonce', methods=['POST']` | `issue_integrity_nonce` |
| 5290 | `api_v1` | `'/security/ios-integrity/verify', methods=['POST']` | `verify_ios_integrity` |
| 5326 | `api_v1` | `'/premium/start-trial', methods=['POST']` | `premium_start_trial` |
| 5462 | `api_v1` | `'/premium/credits/claim', methods=['POST']` | `claim_monthly_credits` |
| 5519 | `api_v1` | `'/premium/credits/unlock', methods=['POST']` | `unlock_with_credits` |
| 5595 | `api_v1` | `'/premium/credits/history'` | `credits_history` |
| 5628 | `api_v1` | `'/bot/chat', methods=['POST']` | `bot_chat_api` |
| 5694 | `api_v1` | `'/bot/status'` | `bot_status` |
| 5733 | `api_v1` | `'/referral/code'` | `get_referral_code` |
| 5750 | `api_v1` | `'/referral/apply', methods=['POST']` | `apply_referral_code` |
| 5798 | `api_v1` | `'/referral/stats'` | `referral_stats` |
| 5827 | `api_v1` | `'/referral/convert', methods=['POST']` | `convert_referral` |
| 5891 | `api_v1` | `'/elite/leaderboard'` | `elite_leaderboard` |
| 5925 | `api_v1` | `'/elite/story/<int:book_id>'` | `elite_story_detail` |
| 5964 | `api_v1` | `'/classics'` | `classics_list` |
| 6002 | `api_v1` | `'/classics/<int:book_id>'` | `classics_detail` |
| 6040 | `api_v1` | `'/creator/<int:creator_id>/tiers'` | `creator_public_tiers` |
| 6061 | `api_v1` | `'/settings'` | `user_settings` |
| 6126 | `api_v1` | `'/settings', methods=['PUT', 'PATCH']` | `update_user_settings` |
| 6188 | `api_v1` | `'/book-sections'` | `list_book_sections` |
| 6210 | `api_v1` | `'/admin/book-sections'` | `admin_list_book_sections` |
| 6239 | `api_v1` | `'/admin/book-sections', methods=['POST']` | `admin_create_book_section` |
| 6271 | `api_v1` | `'/admin/book-sections/<int:sec_id>', methods=['PUT', 'PATCH']` | `admin_update_book_section` |
| 6313 | `api_v1` | `'/admin/book-sections/<int:sec_id>', methods=['DELETE']` | `admin_delete_book_section` |
| 6344 | `api_v1` | `'/books/<int:book_id>/record-view', methods=['POST']` | `record_book_view_jwt` |
| 6401 | `api_v1` | `'/track/home-impression', methods=['POST']` | `track_home_impression` |
| 6455 | `api_v1` | `'/track/home-click', methods=['POST']` | `track_home_click` |
| 6483 | `api_v1` | `'/track/push-open', methods=['POST']` | `track_push_open` |

### `studio_v2_api.py` (30 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 131 | `studio_v2_bp` | `'/universes', methods=['GET']` | `list_universes` |
| 145 | `studio_v2_bp` | `'/universes', methods=['POST']` | `create_universe` |
| 177 | `studio_v2_bp` | `'/universes/<int:universe_id>', methods=['GET']` | `get_universe` |
| 195 | `studio_v2_bp` | `'/universes/<int:universe_id>', methods=['PATCH']` | `update_universe` |
| 223 | `studio_v2_bp` | `'/universes/<int:universe_id>', methods=['DELETE']` | `delete_universe` |
| 243 | `studio_v2_bp` | `'/series', methods=['GET']` | `list_series` |
| 258 | `studio_v2_bp` | `'/series', methods=['POST']` | `create_series` |
| 297 | `studio_v2_bp` | `'/series/<int:series_id>', methods=['GET']` | `get_series` |
| 329 | `studio_v2_bp` | `'/series/<int:series_id>', methods=['PATCH']` | `update_series` |
| 366 | `studio_v2_bp` | `'/series/<int:series_id>', methods=['DELETE']` | `delete_series` |
| 382 | `studio_v2_bp` | `'/series/<int:series_id>/books', methods=['POST']` | `add_book_to_series` |
| 420 | `studio_v2_bp` | `'/series/<int:series_id>/books/<int:content_id>', methods=['DELETE']` | `remove_book_from_series` |
| 439 | `studio_v2_bp` | `'/series/<int:series_id>/books/reorder', methods=['POST']` | `reorder_series_books` |
| 471 | `studio_v2_bp` | `'/stories/<int:book_id>/arcs', methods=['GET']` | `list_arcs` |
| 487 | `studio_v2_bp` | `'/stories/<int:book_id>/arcs', methods=['POST']` | `create_arc` |
| 516 | `studio_v2_bp` | `'/arcs/<int:arc_id>', methods=['PATCH']` | `update_arc` |
| 548 | `studio_v2_bp` | `'/arcs/<int:arc_id>', methods=['DELETE']` | `delete_arc` |
| 571 | `studio_v2_bp` | `'/studio/stories/<int:book_id>/chapter/<int:ch_num>/schedule', methods=['POST']` | `schedule_chapter` |
| 617 | `studio_v2_bp` | `'/studio/settings', methods=['GET']` | `get_studio_settings` |
| 631 | `studio_v2_bp` | `'/studio/settings', methods=['PATCH']` | `update_studio_settings` |
| 662 | `studio_v2_bp` | `'/studio/pro/status', methods=['GET']` | `studio_pro_status` |
| 685 | `studio_v2_bp` | `'/studio/pro/products', methods=['GET']` | `studio_pro_products` |
| 717 | `studio_v2_bp` | `'/studio/pro/iap-receipt', methods=['POST']` | `studio_pro_iap_receipt` |
| 821 | `studio_v2_bp` | `'/internal/publish-due', methods=['POST']` | `internal_publish_due` |
| 837 | `studio_v2_bp` | `'/search/v2', methods=['GET']` | `search_v2` |
| 897 | `studio_v2_bp` | `'/books/<int:book_id>/series-context', methods=['GET']` | `book_series_context` |
| 959 | `studio_v2_bp` | `'/books/<int:book_id>/next-in-series', methods=['GET']` | `next_in_series` |
| 990 | `studio_v2_bp` | `'/universes/<int:universe_id>/public', methods=['GET']` | `universe_public_detail` |
| 1036 | `studio_v2_bp` | `'/series/<int:series_id>/public', methods=['GET']` | `series_public_detail` |
| 1082 | `studio_v2_bp` | `'/books/<int:book_id>/chapter/<int:ch_num>/access', methods=['GET']` | `chapter_access_state` |

### `profile.py` (27 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 141 | `profile_bp` | `'/profile'` | `my_profile` |
| 148 | `profile_bp` | `'/profile/edit', methods=['GET', 'POST']` | `edit_profile` |
| 155 | `profile_bp` | `'/profile/link-google', methods=['POST']` | `link_google` |
| 215 | `profile_bp` | `'/profile/unlink-google', methods=['POST']` | `unlink_google` |
| 232 | `profile_bp` | `'/become-creator', methods=['GET', 'POST']` | `become_creator` |
| 287 | `profile_bp` | `'/connected-accounts'` | `connected_accounts` |
| 294 | `profile_bp` | `'/reading-streaks'` | `reading_streaks` |
| 375 | `profile_bp` | `'/feedback', methods=['GET', 'POST']` | `feedback` |
| 412 | `profile_bp` | `'/warnings'` | `my_warnings` |
| 419 | `profile_bp` | `'/account/safety'` | `account_safety` |
| 433 | `profile_bp` | `'/warnings/<int:warning_id>/acknowledge', methods=['POST']` | `acknowledge_warning` |
| 451 | `profile_bp` | `'/privacy'` | `privacy_policy` |
| 457 | `profile_bp` | `'/about'` | `about` |
| 463 | `profile_bp` | `'/terms'` | `terms` |
| 469 | `profile_bp` | `'/help'` | `help_center` |
| 475 | `profile_bp` | `'/wiambot'` | `wiambot` |
| 481 | `profile_bp` | `'/privacy-center'` | `privacy_center` |
| 487 | `profile_bp` | `'/community-guidelines'` | `community_guidelines` |
| 496 | `profile_bp` | `'/img/<int:image_id>'` | `serve_image` |
| 529 | `profile_bp` | `'/upload-avatar', methods=['POST']` | `upload_avatar` |
| 557 | `profile_bp` | `'/settings'` | `settings_privacy` |
| 564 | `profile_bp` | `'/settings/update-account', methods=['POST']` | `update_account_info` |
| 603 | `profile_bp` | `'/settings/change-password', methods=['POST']` | `change_password` |
| 629 | `profile_bp` | `'/settings/deactivate', methods=['POST']` | `deactivate_account` |
| 643 | `profile_bp` | `'/notification-settings', methods=['GET', 'POST']` | `notification_settings` |
| 650 | `profile_bp` | `'/settings/update-privacy', methods=['POST']` | `update_privacy` |
| 663 | `profile_bp` | `'/account/delete', methods=['GET', 'POST']` | `delete_account` |

### `voice_api.py` (25 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 212 | `voice_bp` | `'/home', methods=['GET']` | `voice_home` |
| 371 | `voice_bp` | `'/feed', methods=['GET']` | `voice_feed` |
| 395 | `voice_bp` | `'/explore', methods=['GET']` | `voice_explore` |
| 422 | `voice_bp` | `'/story/<int:story_id>', methods=['GET']` | `voice_story_detail` |
| 435 | `voice_bp` | `'/story', methods=['POST']` | `voice_story_create` |
| 471 | `voice_bp` | `'/story/<int:story_id>', methods=['PATCH']` | `voice_story_patch` |
| 519 | `voice_bp` | `'/story/<int:story_id>/publish', methods=['POST']` | `voice_story_publish` |
| 543 | `voice_bp` | `'/moment', methods=['POST']` | `voice_moment_create` |
| 579 | `voice_bp` | `'/upload', methods=['POST']` | `voice_upload` |
| 610 | `voice_bp` | `'/upload-cover', methods=['POST']` | `voice_upload_cover` |
| 664 | `voice_bp` | `'/upload-cover-from-url', methods=['POST']` | `voice_upload_cover_from_url` |
| 719 | `voice_bp` | `'/like/toggle', methods=['POST']` | `voice_like_toggle` |
| 750 | `voice_bp` | `'/comment', methods=['POST']` | `voice_comment_create` |
| 780 | `voice_bp` | `'/story/<int:story_id>/comments', methods=['GET']` | `voice_story_comments` |
| 827 | `voice_bp` | `'/save/toggle', methods=['POST']` | `voice_save_toggle` |
| 852 | `voice_bp` | `'/tip', methods=['POST']` | `voice_tip` |
| 923 | `voice_bp` | `'/unlock', methods=['POST']` | `voice_unlock` |
| 989 | `voice_bp` | `'/library/saved', methods=['GET']` | `voice_library_saved` |
| 1014 | `voice_bp` | `'/me/stories', methods=['GET']` | `voice_my_stories` |
| 1028 | `voice_bp` | `'/story/<int:story_id>/register_listen', methods=['POST']` | `voice_register_listen` |
| 1059 | `voice_bp` | `'/story/<int:story_id>/progress', methods=['POST']` | `voice_story_progress` |
| 1105 | `voice_bp` | `'/story/<int:story_id>/presence', methods=['GET']` | `voice_story_presence` |
| 1121 | `voice_bp` | `'/story/<int:story_id>/presence/heartbeat', methods=['POST']` | `voice_story_presence_heartbeat` |
| 1154 | `voice_bp` | `'/story/<int:story_id>/room/messages', methods=['GET']` | `voice_room_messages` |
| 1190 | `voice_bp` | `'/story/<int:story_id>/room/messages', methods=['POST']` | `voice_room_messages_post` |

### `studio.py` (24 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 29 | `studio_bp` | `'/'` | `dashboard` |
| 137 | `studio_bp` | `'/monetization-guide'` | `monetization_guide` |
| 144 | `studio_bp` | `'/new', methods=['GET', 'POST']` | `new_book` |
| 238 | `studio_bp` | `'/<int:book_id>'` | `editor` |
| 283 | `studio_bp` | `'/<int:book_id>/save', methods=['POST']` | `save_chapter` |
| 330 | `studio_bp` | `'/<int:book_id>/chapter/add', methods=['POST']` | `add_chapter` |
| 370 | `studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>/delete', methods=['POST']` | `delete_chapter` |
| 410 | `studio_bp` | `'/<int:book_id>/delete', methods=['POST']` | `delete_book` |
| 512 | `studio_bp` | `'/<int:book_id>/settings', methods=['POST']` | `update_settings` |
| 561 | `studio_bp` | `'/<int:book_id>/publish', methods=['POST']` | `publish` |
| 692 | `studio_bp` | `'/<int:book_id>/unpublish', methods=['POST']` | `unpublish` |
| 706 | `studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>/publish', methods=['POST']` | `publish_chapter` |
| 753 | `studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>/unpublish', methods=['POST']` | `unpublish_chapter` |
| 773 | `studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>/lock', methods=['POST']` | `toggle_chapter_lock` |
| 835 | `studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>/premium-lock', methods=['POST']` | `toggle_premium_lock` |
| 888 | `studio_bp` | `'/<int:book_id>/publish-all-chapters', methods=['POST']` | `publish_all_chapters` |
| 956 | `studio_bp` | `'/<int:book_id>/preview'` | `preview` |
| 1004 | `studio_bp` | `'/<int:book_id>/cover', methods=['POST']` | `upload_cover` |
| 1072 | `studio_bp` | `'/covers/<filename>'` | `serve_uploaded_cover` |
| 1085 | `studio_bp` | `'/<int:book_id>/request-review', methods=['POST']` | `request_review` |
| 1178 | `studio_bp` | `'/<int:book_id>/resubmit-review', methods=['POST']` | `resubmit_review` |
| 1216 | `studio_bp` | `'/<int:book_id>/review-status'` | `review_status` |
| 1244 | `studio_bp` | `'/top-readers'` | `top_readers` |
| 1347 | `studio_bp` | `'/gift-reader', methods=['POST']` | `gift_reader_coins` |

### `book.py` (20 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 23 | `book_bp` | `'/<int:book_id>'` | `detail` |
| 149 | `book_bp` | `'/<int:book_id>/rate', methods=['POST']` | `rate_book` |
| 203 | `book_bp` | `'/<int:book_id>/review', methods=['POST']` | `submit_review` |
| 232 | `book_bp` | `'/<int:book_id>/review/<int:review_id>/delete', methods=['POST']` | `delete_review` |
| 253 | `book_bp` | `'/<int:book_id>/review/<int:review_id>/like', methods=['POST']` | `toggle_review_like` |
| 271 | `book_bp` | `'/<int:book_id>/record-view', methods=['POST']` | `record_view` |
| 297 | `book_bp` | `'/<int:book_id>/read'` | `read_book` |
| 446 | `book_bp` | `'/<int:book_id>/download'` | `download_pdf` |
| 549 | `book_bp` | `'/<int:book_id>/track-share', methods=['POST']` | `track_share` |
| 574 | `book_bp` | `'/<int:book_id>/report', methods=['POST']` | `report_content` |
| 610 | `book_bp` | `'/<int:book_id>/chapter/<int:ch_num>/like', methods=['POST']` | `toggle_chapter_like` |
| 640 | `book_bp` | `'/<int:book_id>/chapter/<int:ch_num>/vote', methods=['POST']` | `toggle_chapter_vote` |
| 671 | `book_bp` | `'/<int:book_id>/chapter/<int:ch_num>/comments', methods=['GET']` | `get_chapter_comments` |
| 705 | `book_bp` | `'/<int:book_id>/chapter/<int:ch_num>/comment', methods=['POST']` | `add_chapter_comment` |
| 742 | `book_bp` | `'/comment/<int:comment_id>/like', methods=['POST']` | `toggle_comment_like` |
| 763 | `book_bp` | `'/comment/<int:comment_id>/delete', methods=['POST']` | `delete_chapter_comment` |
| 782 | `book_bp` | `'/<int:book_id>/read/<int:ch_num>/paragraph/<int:para_idx>/comments'` | `paragraph_comments` |
| 837 | `book_bp` | `'/<int:book_id>/read/<int:ch_num>/comments'` | `chapter_comments_page` |
| 883 | `book_bp` | `'/<int:book_id>/comments'` | `book_comments` |
| 917 | `book_bp` | `'/<int:book_id>/gift-stickers'` | `gift_stickers` |

### `api.py` (18 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 12 | `api_bp` | `'/api/health'` | `health_check` |
| 18 | `api_bp` | `'/api/bug-report', methods=['POST']` | `bug_report` |
| 57 | `api_bp` | `'/api/cover/<file_id>'` | `serve_cover` |
| 67 | `api_bp` | `'/api/pdf/<int:book_id>'` | `serve_pdf` |
| 103 | `api_bp` | `'/api/reader-pref', methods=['POST']` | `save_reader_pref` |
| 130 | `api_bp` | `'/api/push/subscribe', methods=['POST']` | `push_subscribe` |
| 152 | `api_bp` | `'/api/push/unsubscribe', methods=['POST']` | `push_unsubscribe` |
| 167 | `api_bp` | `'/api/push/vapid-key'` | `vapid_public_key` |
| 180 | `api_bp` | `'/api/reading/log', methods=['POST']` | `log_reading` |
| 202 | `api_bp` | `'/api/reading/streak'` | `get_streak` |
| 239 | `api_bp` | `'/api/bookmarks', methods=['GET']` | `get_bookmarks` |
| 252 | `api_bp` | `'/api/bookmarks', methods=['POST']` | `add_bookmark` |
| 272 | `api_bp` | `'/api/bookmarks/<int:bm_id>', methods=['DELETE']` | `delete_bookmark` |
| 289 | `api_bp` | `'/api/shelves'` | `get_shelves` |
| 302 | `api_bp` | `'/api/shelves', methods=['POST']` | `create_shelf` |
| 322 | `api_bp` | `'/api/shelves/<int:shelf_id>/add', methods=['POST']` | `add_to_shelf` |
| 339 | `api_bp` | `'/api/shelves/<int:shelf_id>/remove', methods=['POST']` | `remove_from_shelf` |
| 358 | `api_bp` | `'/api/bot-unmatched', methods=['POST']` | `bot_unmatched` |

### `team.py` (17 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 551 | `team_bp` | `'/careers'` | `careers` |
| 585 | `team_bp` | `'/careers/apply/<role_type>', methods=['GET', 'POST']` | `apply_role` |
| 689 | `team_bp` | `'/careers/verify-email', methods=['GET', 'POST']` | `verify_application_email` |
| 1192 | `team_bp` | `'/qa/automation/report', methods=['POST']` | `qa_automation_report` |
| 1246 | `team_bp` | `'/qa/watchdog/probe', methods=['POST']` | `qa_watchdog_probe` |
| 1386 | `team_bp` | `'/'` | `dashboard` |
| 1497 | `team_bp` | `'/editor/review/<int:story_id>'` | `editor_review` |
| 1512 | `team_bp` | `'/editor/approve/<int:story_id>', methods=['POST']` | `editor_approve` |
| 1531 | `team_bp` | `'/editor/request-revision/<int:story_id>', methods=['POST']` | `editor_request_revision` |
| 1552 | `team_bp` | `'/mod/flag/<int:story_id>', methods=['POST']` | `mod_flag_story` |
| 1568 | `team_bp` | `'/mod/unflag/<int:story_id>', methods=['POST']` | `mod_unflag_story` |
| 1584 | `team_bp` | `'/mod/ban-user/<int:user_id>', methods=['POST']` | `mod_ban_user` |
| 1603 | `team_bp` | `'/mod/unban-user/<int:user_id>', methods=['POST']` | `mod_unban_user` |
| 1619 | `team_bp` | `'/mod/flagged-stories'` | `mod_flagged_stories` |
| 1633 | `team_bp` | `'/admin/auth-gate/save', methods=['POST']` | `save_auth_gate` |
| 1688 | `team_bp` | `'/admin/users'` | `admin_user_list` |
| 1726 | `team_bp` | `'/feedback/<int:fb_id>/reply', methods=['POST']` | `reply_feedback` |

### `editor_studio.py` (14 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 99 | `editor_studio_bp` | `'/'` | `dashboard` |
| 169 | `editor_studio_bp` | `'/<int:book_id>'` | `review` |
| 230 | `editor_studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>'` | `read_chapter` |
| 272 | `editor_studio_bp` | `'/<int:book_id>/note', methods=['POST']` | `add_note` |
| 326 | `editor_studio_bp` | `'/<int:book_id>/approve', methods=['POST']` | `approve` |
| 367 | `editor_studio_bp` | `'/<int:book_id>/reject', methods=['POST']` | `reject` |
| 412 | `editor_studio_bp` | `'/<int:book_id>/request-revision', methods=['POST']` | `request_revision` |
| 456 | `editor_studio_bp` | `'/<int:book_id>/assign', methods=['POST']` | `assign_to_me` |
| 488 | `editor_studio_bp` | `'/<int:book_id>/chapter/<int:ch_num>/save', methods=['POST']` | `save_chapter` |
| 538 | `editor_studio_bp` | `'/<int:book_id>/edit-metadata', methods=['POST']` | `edit_metadata` |
| 604 | `editor_studio_bp` | `'/<int:book_id>/replace-cover', methods=['POST']` | `replace_cover` |
| 665 | `editor_studio_bp` | `'/content'` | `content_browse` |
| 732 | `editor_studio_bp` | `'/my-reviews'` | `my_reviews` |
| 755 | `editor_studio_bp` | `'/stats'` | `stats` |

### `admin_dash.py` (13 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 40 | `admin_dash_bp` | `'/'` | `overview` |
| 62 | `admin_dash_bp` | `'/content'` | `content` |
| 88 | `admin_dash_bp` | `'/content/<int:book_id>/approve', methods=['POST']` | `approve_book` |
| 109 | `admin_dash_bp` | `'/content/<int:book_id>/reject', methods=['POST']` | `reject_book` |
| 120 | `admin_dash_bp` | `'/content/<int:book_id>/delete', methods=['POST']` | `delete_book` |
| 132 | `admin_dash_bp` | `'/users'` | `users` |
| 151 | `admin_dash_bp` | `'/users/<int:user_id>/ban', methods=['POST']` | `toggle_ban` |
| 170 | `admin_dash_bp` | `'/orders'` | `orders` |
| 191 | `admin_dash_bp` | `'/orders/<int:order_id>/approve', methods=['POST']` | `approve_order` |
| 215 | `admin_dash_bp` | `'/orders/<int:order_id>/reject', methods=['POST']` | `reject_order` |
| 232 | `admin_dash_bp` | `'/creators'` | `creators` |
| 243 | `admin_dash_bp` | `'/creators/<int:user_id>/approve', methods=['POST']` | `approve_creator` |
| 255 | `admin_dash_bp` | `'/creators/<int:user_id>/reject', methods=['POST']` | `reject_creator` |

### `programs.py` (12 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 54 | `programs_bp` | `'/'` | `hub` |
| 84 | `programs_bp` | `'/rising'` | `rising` |
| 110 | `programs_bp` | `'/challenges'` | `challenges` |
| 137 | `programs_bp` | `'/challenges/<int:challenge_id>'` | `challenge_detail` |
| 161 | `programs_bp` | `'/challenges/<int:challenge_id>/join', methods=['POST']` | `challenge_join` |
| 194 | `programs_bp` | `'/gift'` | `gift_sub` |
| 213 | `programs_bp` | `'/gift/send', methods=['POST']` | `gift_send` |
| 281 | `programs_bp` | `'/milestones'` | `milestones` |
| 370 | `programs_bp` | `'/ambassador'` | `ambassador` |
| 584 | `programs_bp` | `'/magic-box'` | `magic_box` |
| 638 | `programs_bp` | `'/magic-box/earn', methods=['POST']` | `magic_box_earn` |
| 681 | `programs_bp` | `'/magic-box/open/<int:box_id>', methods=['POST']` | `magic_box_open` |

### `creator_sub.py` (11 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 59 | `creator_sub_bp` | `'/subscribe', methods=['POST']` | `subscribe` |
| 80 | `creator_sub_bp` | `'/cancel', methods=['POST']` | `cancel` |
| 99 | `creator_sub_bp` | `'/my-subscriptions'` | `my_subscriptions` |
| 118 | `creator_sub_bp` | `'/check/<int:creator_id>'` | `check` |
| 155 | `creator_sub_bp` | `'/tiers', methods=['GET']` | `list_tiers` |
| 178 | `creator_sub_bp` | `'/tiers', methods=['POST']` | `create_tier_route` |
| 224 | `creator_sub_bp` | `'/tiers/<int:tier_id>', methods=['PUT', 'PATCH']` | `update_tier_route` |
| 261 | `creator_sub_bp` | `'/subscribers'` | `list_subscribers` |
| 308 | `creator_sub_bp` | `'/earnings'` | `subscription_earnings` |
| 347 | `creator_sub_bp` | `'/eligibility'` | `eligibility_progress` |
| 365 | `creator_sub_bp` | `'/creator/<int:creator_id>/tiers'` | `creator_tiers_public` |

### `notifications.py` (11 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 20 | `notifications_bp` | `'/'` | `list_notifications` |
| 40 | `notifications_bp` | `'/count'` | `unread_count` |
| 51 | `notifications_bp` | `'/read/<int:notif_id>'` | `read_and_redirect` |
| 68 | `notifications_bp` | `'/clear', methods=['POST']` | `clear_all` |
| 81 | `notifications_bp` | `'/delete/<int:notif_id>', methods=['POST']` | `delete_notification` |
| 96 | `notifications_bp` | `'/delete-all', methods=['POST']` | `delete_all` |
| 109 | `notifications_bp` | `'/poll'` | `poll_notifications` |
| 144 | `notifications_bp` | `'/recent'` | `recent_notifications` |
| 168 | `notifications_bp` | `'/push/vapid-key'` | `vapid_public_key` |
| 176 | `notifications_bp` | `'/push/subscribe', methods=['POST']` | `push_subscribe` |
| 210 | `notifications_bp` | `'/push/unsubscribe', methods=['POST']` | `push_unsubscribe` |

### `payment.py` (11 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 88 | `payment_bp` | `'/coins'` | `coins` |
| 101 | `payment_bp` | `'/coins/initialize', methods=['POST']` | `initialize` |
| 162 | `payment_bp` | `'/callback'` | `callback` |
| 237 | `payment_bp` | `'/webhook', methods=['POST']` | `webhook` |
| 639 | `payment_bp` | `'/success'` | `success` |
| 651 | `payment_bp` | `'/coins/history'` | `history` |
| 719 | `payment_bp` | `'/unlock', methods=['POST']` | `unlock_chapter` |
| 802 | `payment_bp` | `'/unlock-premium', methods=['POST']` | `unlock_chapter_premium` |
| 840 | `payment_bp` | `'/tip', methods=['POST']` | `tip_creator` |
| 907 | `payment_bp` | `'/tip-history'` | `tip_history` |
| 944 | `payment_bp` | `'/webhooks/revenuecat', methods=['POST']` | `revenuecat_webhook` |

### `bulletin.py` (10 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 65 | `bulletin_bp` | `'/'` | `bulletin_list` |
| 142 | `bulletin_bp` | `'/official'` | `official_feed` |
| 191 | `bulletin_bp` | `'/<int:creator_id>'` | `feed` |
| 266 | `bulletin_bp` | `'/<int:creator_id>/follow', methods=['POST']` | `toggle_bulletin_follow` |
| 300 | `bulletin_bp` | `'/official/post', methods=['POST']` | `create_official_post` |
| 325 | `bulletin_bp` | `'/<int:creator_id>/post', methods=['POST']` | `create_post` |
| 373 | `bulletin_bp` | `'/share-book', methods=['POST']` | `share_book` |
| 421 | `bulletin_bp` | `'/react/<int:post_id>', methods=['POST']` | `react` |
| 461 | `bulletin_bp` | `'/pin/<int:post_id>', methods=['POST']` | `toggle_pin` |
| 482 | `bulletin_bp` | `'/delete/<int:post_id>', methods=['POST']` | `delete_post` |

### `classics.py` (10 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 38 | `classics_bp` | `'/dashboard'` | `dashboard` |
| 60 | `classics_bp` | `'/fetch', methods=['POST']` | `fetch_books` |
| 90 | `classics_bp` | `'/review/<int:book_id>'` | `review` |
| 100 | `classics_bp` | `'/publish/<int:book_id>', methods=['POST']` | `publish` |
| 113 | `classics_bp` | `'/delete/<int:book_id>', methods=['POST']` | `delete` |
| 126 | `classics_bp` | `'/log/delete/<int:log_id>', methods=['POST']` | `delete_log` |
| 143 | `classics_bp` | `'/log/return/<int:log_id>', methods=['POST']` | `return_log` |
| 172 | `classics_bp` | `'/manage'` | `manage` |
| 185 | `classics_bp` | `'/book/<int:book_id>'` | `book_detail` |
| 213 | `classics_bp` | `'/book/<int:book_id>/read/<int:chapter_num>'` | `read_chapter` |

### `dashboard.py` (10 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 25 | `dashboard_bp` | `'/'` | `index` |
| 391 | `dashboard_bp` | `'/edit-profile', methods=['POST']` | `edit_profile` |
| 465 | `dashboard_bp` | `'/update-account', methods=['POST']` | `update_account` |
| 490 | `dashboard_bp` | `'/change-password', methods=['POST']` | `change_password` |
| 514 | `dashboard_bp` | `'/update-notifications', methods=['POST']` | `update_notifications` |
| 536 | `dashboard_bp` | `'/update-privacy', methods=['POST']` | `update_privacy` |
| 549 | `dashboard_bp` | `'/payout-settings', methods=['POST']` | `payout_settings` |
| 593 | `dashboard_bp` | `'/upload-avatar', methods=['POST']` | `upload_avatar` |
| 618 | `dashboard_bp` | `'/send-feedback', methods=['POST']` | `send_feedback` |
| 641 | `dashboard_bp` | `'/create-sub-tier', methods=['POST']` | `create_sub_tier` |

### `wiambot.py` (10 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 27 | `bot_bp` | `'/api/bot/chat', methods=['POST']` | `bot_chat` |
| 43 | `bot_bp` | `'/api/bot/templates'` | `bot_templates` |
| 50 | `bot_bp` | `'/api/bot/analyze', methods=['POST']` | `bot_analyze` |
| 67 | `bot_bp` | `'/help'` | `help_center` |
| 76 | `bot_bp` | `'/creator-tools'` | `creator_tools` |
| 85 | `bot_bp` | `'/apex/submit', methods=['GET', 'POST']` | `apex_submit` |
| 188 | `bot_bp` | `'/apex/status/<int:submission_id>'` | `apex_status` |
| 200 | `bot_bp` | `'/founder/apex-review'` | `apex_review` |
| 229 | `bot_bp` | `'/founder/apex-review/<int:submission_id>'` | `apex_review_detail` |
| 240 | `bot_bp` | `'/founder/apex-review/<int:submission_id>/action', methods=['POST']` | `apex_review_action` |

### `creator_dash.py` (9 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 23 | `creator_dash_bp` | `'/'` | `overview` |
| 30 | `creator_dash_bp` | `'/books'` | `my_books` |
| 37 | `creator_dash_bp` | `'/orders'` | `my_orders` |
| 44 | `creator_dash_bp` | `'/orders/<int:order_id>/approve', methods=['POST']` | `approve_order` |
| 74 | `creator_dash_bp` | `'/orders/<int:order_id>/reject', methods=['POST']` | `reject_order` |
| 95 | `creator_dash_bp` | `'/earnings'` | `earnings` |
| 102 | `creator_dash_bp` | `'/payout-settings', methods=['GET', 'POST']` | `payout_settings` |
| 109 | `creator_dash_bp` | `'/profile', methods=['GET', 'POST']` | `edit_profile` |
| 116 | `creator_dash_bp` | `'/followers'` | `followers` |

### `reader_api.py` (9 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 18 | `reader_api` | `'/react', methods=['POST']` | `react` |
| 65 | `reader_api` | `'/reactions', methods=['GET']` | `get_reactions` |
| 93 | `reader_api` | `'/comment', methods=['POST']` | `add_comment` |
| 156 | `reader_api` | `'/comments', methods=['GET']` | `get_comments` |
| 208 | `reader_api` | `'/comment-counts', methods=['GET']` | `comment_counts` |
| 227 | `reader_api` | `'/comment/<int:comment_id>/like', methods=['POST']` | `like_comment` |
| 252 | `reader_api` | `'/comment/<int:comment_id>/delete', methods=['POST']` | `delete_comment` |
| 271 | `reader_api` | `'/pref', methods=['POST']` | `save_pref` |
| 309 | `reader_api` | `'/save-position', methods=['POST']` | `save_position` |

### `gift.py` (8 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 39 | `gift_bp` | `'/send/<int:book_id>', methods=['GET', 'POST']` | `send_gift` |
| 63 | `gift_bp` | `'/sent/<int:gift_id>'` | `gift_sent` |
| 75 | `gift_bp` | `'/claim/<code>'` | `claim_gift` |
| 122 | `gift_bp` | `'/my-gifts'` | `my_gifts` |
| 142 | `gift_bp` | `'/sticker/send', methods=['POST']` | `send_sticker` |
| 239 | `gift_bp` | `'/sticker/data/<int:content_id>'` | `sticker_data` |
| 262 | `gift_bp` | `'/stickers'` | `sticker_history` |
| 277 | `gift_bp` | `'/celebrate/<int:gift_id>'` | `celebrate` |

### `elite.py` (7 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 44 | `elite_bp` | `'/'` | `elite_page` |
| 168 | `elite_bp` | `'/book/<int:book_id>'` | `elite_book_detail` |
| 221 | `elite_bp` | `'/celebrate/<int:content_id>'` | `celebration_card` |
| 243 | `elite_bp` | `'/subscribe'` | `subscribe_page` |
| 272 | `elite_bp` | `'/subscribe/activate', methods=['POST']` | `subscribe_activate` |
| 338 | `elite_bp` | `'/subscribe/callback'` | `subscribe_callback` |
| 411 | `elite_bp` | `'/subscribe/cancel', methods=['POST']` | `subscribe_cancel` |

### `premium.py` (6 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 36 | `premium_bp` | `'/'` | `premium_page` |
| 69 | `premium_bp` | `'/activate', methods=['POST']` | `activate` |
| 138 | `premium_bp` | `'/callback'` | `callback` |
| 213 | `premium_bp` | `'/cancel', methods=['POST']` | `cancel` |
| 255 | `premium_bp` | `'/manage'` | `manage` |
| 305 | `premium_bp` | `'/apex'` | `apex_page` |

### `seo.py` (6 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 34 | `seo_bp` | `'/sw.js'` | `service_worker` |
| 43 | `seo_bp` | `'/robots.txt'` | `robots` |
| 90 | `seo_bp` | `'/sitemap.xml'` | `sitemap` |
| 154 | `seo_bp` | `'/data-deletion'` | `data_deletion` |
| 165 | `seo_bp` | `'/.well-known/assetlinks.json'` | `android_assetlinks` |
| 205 | `seo_bp` | `'/.well-known/apple-app-site-association'` | `apple_aasa` |

### `home.py` (4 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 97 | `home_bp` | `'/debug/books'` | `debug_books` |
| 135 | `home_bp` | `'/.well-known/apple-developer-merchantid-domain-association'` | `apple_pay_verification` |
| 158 | `home_bp` | `'/'` | `index` |
| 177 | `home_bp` | `'/home'` | `home` |

### `browse.py` (3 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 27 | `browse_bp` | `'/'` | `browse_home` |
| 49 | `browse_bp` | `'/genre/<genre_name>'` | `genre_books` |
| 71 | `browse_bp` | `'/search'` | `search` |

### `library.py` (3 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 9 | `library_bp` | `'/'` | `my_library` |
| 65 | `library_bp` | `'/toggle', methods=['POST']` | `toggle_library` |
| 86 | `library_bp` | `'/check/<int:content_id>'` | `check_library` |

### `creator.py` (2 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 11 | `creator_bp` | `'/creator/<username>'` | `profile` |
| 101 | `creator_bp` | `'/creator/<int:creator_id>/follow', methods=['POST']` | `toggle_follow` |

### `apply.py` (1 routes)

| Line | Blueprint | Route args | Handler |
|-----:|-----------|------------|---------|
| 11 | `apply_bp` | `'/apply/<token>', methods=['GET', 'POST']` | `fill_form` |

## C. Every web template

Count: **174**

- `about.html`
- `account_deactivated.html`
- `account_safety.html`
- `admin/content.html`
- `admin/creators.html`
- `admin/orders.html`
- `admin/overview.html`
- `admin/users.html`
- `apex.html`
- `apply_done.html`
- `apply_form.html`
- `base.html`
- `become_creator.html`
- `become_creator_form.html`
- `book_comments.html`
- `book_detail.html`
- `browse.html`
- `bulletin.html`
- `bulletin_feed.html`
- `bulletin_list.html`
- `bulletin_post_card.html`
- `careers.html`
- `chapter_comments.html`
- `classics_detail.html`
- `classics_reader.html`
- `community_guidelines.html`
- `creator_profile.html`
- `dashboard.html`
- `dashboard_base.html`
- `data_deletion.html`
- `delete_account.html`
- `editor_studio/content_browse.html`
- `editor_studio/dashboard.html`
- `editor_studio/my_reviews.html`
- `editor_studio/review.html`
- `elite.html`
- `elite_book.html`
- `elite_celebrate.html`
- `elite_subscribe.html`
- `error.html`
- `favorites.html`
- `feature_locked.html`
- `forgot_password.html`
- `founder/_dashboard_switcher.html`
- `founder/accounts.html`
- `founder/admins.html`
- `founder/ai_content_review.html`
- `founder/ai_status.html`
- `founder/analytics_content.html`
- `founder/analytics_platform.html`
- `founder/analytics_users.html`
- `founder/announcements.html`
- `founder/apex_review.html`
- `founder/apex_review_detail.html`
- `founder/banned_words.html`
- `founder/book_sections.html`
- `founder/classics_dashboard.html`
- `founder/classics_manage.html`
- `founder/classics_review.html`
- `founder/coin_purchases.html`
- `founder/collection_detail.html`
- `founder/collections.html`
- `founder/content.html`
- `founder/creators.html`
- `founder/disputes.html`
- `founder/elite.html`
- `founder/email_studio.html`
- `founder/feedback.html`
- `founder/financial.html`
- `founder/form_responses.html`
- `founder/forms_dashboard.html`
- `founder/genres.html`
- `founder/moderation.html`
- `founder/notifications.html`
- `founder/orders.html`
- `founder/overview.html`
- `founder/payouts.html`
- `founder/payroll.html`
- `founder/platform_settings.html`
- `founder/premium_analytics.html`
- `founder/revenue.html`
- `founder/review_queue.html`
- `founder/settings.html`
- `founder/subscribers.html`
- `founder/team_comp_plans.html`
- `founder/team_management.html`
- `founder/users.html`
- `founder/warnings.html`
- `founder/withdrawals.html`
- `genre_books.html`
- `gift/celebrate.html`
- `gift/claimed.html`
- `gift/my_gifts.html`
- `gift/send.html`
- `gift/sent.html`
- `gift/sticker_history.html`
- `gift_stickers.html`
- `help_center.html`
- `home.html`
- `includes/google_ads.html`
- `install_app.html`
- `landing.html`
- `library.html`
- `login.html`
- `notifications.html`
- `onboarding.html`
- `paragraph_comments.html`
- `partials/_warning_modal.html`
- `payment/checkout.html`
- `payment/coins.html`
- `payment/history.html`
- `payment/instructions.html`
- `payment/status.html`
- `payment/success.html`
- `payment/tip_history.html`
- `premium_subscribe.html`
- `privacy.html`
- `privacy_center.html`
- `programs/ambassador.html`
- `programs/challenge_detail.html`
- `programs/challenges.html`
- `programs/gift_sub.html`
- `programs/hub.html`
- `programs/magic_box.html`
- `programs/milestones.html`
- `programs/rising.html`
- `qr_login.html`
- `reader.html`
- `reading_streaks.html`
- `register.html`
- `reset_password.html`
- `search_results.html`
- `settings_2fa.html`
- `studio/dashboard.html`
- `studio/editor.html`
- `studio/monetization_guide.html`
- `studio/new_book.html`
- `studio/preview.html`
- `studio/top_readers.html`
- `subscription_manage.html`
- `switch_account.html`
- `switch_verify.html`
- `team/_dashboard_switcher.html`
- `team/_greeting.html`
- `team/admin_dashboard.html`
- `team/analyst_dashboard.html`
- `team/community_manager_dashboard.html`
- `team/editor_dashboard.html`
- `team/engineer_dashboard.html`
- `team/finance_dashboard.html`
- `team/marketing_dashboard.html`
- `team/moderator_dashboard.html`
- `team/overall_boss_dashboard.html`
- `team/qa_tester_dashboard.html`
- `team/support_dashboard.html`
- `team/team_lead_dashboard.html`
- `team/translator_dashboard.html`
- `team_admin_users.html`
- `team_apply.html`
- `team_dashboard.html`
- `team_editor_review.html`
- `team_flagged.html`
- `team_verify_email.html`
- `terms.html`
- `user_feedback.html`
- `user_warnings.html`
- `verify_2fa.html`
- `verify_email.html`
- `web_reader.html`
- `wiambot.html`
- `wiambot/apex_status.html`
- `wiambot/apex_submit.html`
- `wiambot/chat.html`
- `wiambot/creator_tools.html`

## D. Every Expo screen

Count: **65**

- `auth/ForgotPasswordScreen.js`
- `auth/LandingScreen.js`
- `auth/LoginScreen.js`
- `auth/OnboardingFlowScreen.js`
- `auth/PostOnboardingCreatorScreen.js`
- `auth/PostOnboardingMissionScreen.js`
- `auth/PostOnboardingPremiumScreen.js`
- `auth/PreparingScreen.js`
- `auth/RegisterScreen.js`
- `auth/RegistrationFinishScreen.js`
- `auth/ResetPasswordScreen.js`
- `auth/WelcomeBonusScreen.js`
- `content/BookDetailScreen.js`
- `content/CreatorProfileScreen.js`
- `content/ReaderScreen.js`
- `content/SeriesDetailScreen.js`
- `content/UniverseDetailScreen.js`
- `creator/ApplyScreen.js`
- `creator/WelcomeCreatorScreen.js`
- `main/AccountSafetyScreen.js`
- `main/BrowseScreen.js`
- `main/BulletinScreen.js`
- `main/CareersScreen.js`
- `main/ClassicsScreen.js`
- `main/CoinHistoryScreen.js`
- `main/CreatorSubscriptionScreen.js`
- `main/FeedbackScreen.js`
- `main/GiftsScreen.js`
- `main/GlobalSearchScreen.js`
- `main/GuestHomeScreen.js`
- `main/HelpCenterScreen.js`
- `main/HomeScreen.js`
- `main/HubScreen.js`
- `main/LibraryScreen.js`
- `main/NotificationsScreen.js`
- `main/OfflineReadingScreen.js`
- `main/PremiumTabScreen.js`
- `main/ProfileScreen.js`
- `main/ProgramsScreen.js`
- `main/ReaderStatsScreen.js`
- `main/ReadingListDetailScreen.js`
- `main/ReadingStreaksScreen.js`
- `main/ScheduleScreen.js`
- `main/SettingsScreen.js`
- `main/TipHistoryScreen.js`
- `main/WalletScreen.js`
- `main/WiamBotScreen.js`
- `main/WiamEliteScreen.js`
- `studio/ChapterEditorScreen.js`
- `studio/EarningsScreen.js`
- `studio/NewStoryScreen.js`
- `studio/OrderApprovalsScreen.js`
- `studio/StoryAnalyticsScreen.js`
- `studio/StoryManagerScreen.js`
- `studio/StudioDashboardScreen.js`
- `studio/StudioTabScreen.js`
- `studio/v2/AIComingSoonScreen.js`
- `studio/v2/SeriesEditorScreen.js`
- `studio/v2/StudioLibraryScreen.js`
- `studio/v2/StudioMoneyScreen.js`
- `studio/v2/StudioProPaywallScreen.js`
- `studio/v2/StudioScheduleScreen.js`
- `studio/v2/StudioSettingsScreen.js`
- `studio/v2/StudioTourModal.js`
- `studio/v2/UniverseEditorScreen.js`

## E. Expo API modules

- `auth.js`
- `books.js`
- `bot.js`
- `bulletin.js`
- `classics.js`
- `client.js`
- `coins.js`
- `creator.js`
- `elite.js`
- `reader.js`
- `settings.js`
- `studio.js`
- `studioV2.js`
- `tracking.js`
- `wallet.js`

## F. Web services

- `ai_curation.py`
- `ai_service.py`
- `analytics.py`
- `apex_ai.py`
- `bot_review.py`
- `channel_post.py`
- `chapter_sanitizer.py`
- `classics_service.py`
- `content_guard.py`
- `cover_scanner.py`
- `creator_activation.py`
- `creator_approval.py`
- `creator_sub_service.py`
- `elite.py`
- `email_notify.py`
- `email_service.py`
- `expo_push.py`
- `founder_ai.py`
- `home_sections_v2.py`
- `iap.py`
- `image_service.py`
- `integrity_nonce.py`
- `ios_integrity.py`
- `ledger.py`
- `moderation.py`
- `monetization.py`
- `notifications.py`
- `payroll_service.py`
- `platform_notify.py`
- `play_integrity.py`
- `popularity.py`
- `premium_service.py`
- `push_service.py`
- `qa_watchdog.py`
- `rate_guard.py`
- `rbac.py`
- `recommendation_service.py`
- `studio_pro.py`
- `telegram_notify.py`
- `trust_engine.py`
- `wiambot.py`

## G. Completeness stamp

- Models: 130
- Routes: 611
- Templates: 174
- Expo screens: 65
- Step 1 inventory: COMPLETE
