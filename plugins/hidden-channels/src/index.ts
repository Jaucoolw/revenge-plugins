import { findByProps, findByName } from "@vendetta/metro";
import { constants, React, ReactNative as RN } from "@vendetta/metro/common";
import HiddenChannel from "./HiddenChannel";
import AlertContent from "./AlertContent";
import { Settings } from "./settings";
import { getAssetByName } from "@vendetta/ui/assets";
import { after, instead } from "@vendetta/patcher";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { storage } from "@vendetta/plugin";

const Permissions = findByProps("getChannelPermissions", "can");

const Fetcher = findByProps("stores", "fetchMessages");

const { ChannelTypes } = findByProps("ChannelTypes");

const { getChannel } =
    findByProps("getChannel") || findByName("getChannel", false);

const snowflakeUtils = findByProps("extractTimestamp");

const skipChannels = [
    ChannelTypes.DM,
    ChannelTypes.GROUP_DM,
    ChannelTypes.GUILD_CATEGORY,
];

function isHidden(channel: any | undefined) {
    if (channel === undefined) return false;

    if (typeof channel === "string") {
        channel = getChannel(channel);
    }

    if (!channel || skipChannels.includes(channel.type)) {
        return false;
    }

    channel.realCheck = true;

    const result = !Permissions.can(
        constants.Permissions.VIEW_CHANNEL,
        channel
    );

    delete channel.realCheck;

    return result;
}

console.log("[HiddenChannels] Plugin loaded");

const unpatches: (() => void)[] = [];

export default {
    onLoad: () => {
        storage.showIcon ??= true;
        storage.showPopup ??= true;

        /*
         * Make Discord's normal VIEW_CHANNEL checks succeed.
         *
         * isHidden() sets realCheck so that it can still perform
         * the actual permission check.
         */
        unpatches.push(
            after(
                "can",
                Permissions,
                ([permID, channel], result) => {
                    if (
                        !channel?.realCheck &&
                        permID === constants.Permissions.VIEW_CHANNEL
                    ) {
                        return true;
                    }

                    return result;
                }
            )
        );

        /*
         * Prevent fetching messages from hidden channels.
         */
        if (Fetcher?.fetchMessages) {
            unpatches.push(
                instead(
                    "fetchMessages",
                    Fetcher,
                    (args, orig) => {
                        const channel = args[0];

                        console.log(
                            "[HiddenChannels] fetchMessages:",
                            channel
                        );

                        if (!isHidden(channel)) {
                            return orig(...args);
                        }

                        console.log(
                            "[HiddenChannels] Blocked message fetch for hidden channel"
                        );

                        return;
                    }
                )
            );
        } else {
            console.warn(
                "[HiddenChannels] fetchMessages was not found"
            );
        }

        /*
         * Handle channel navigation.
         *
         * IMPORTANT:
         * There is intentionally only ONE navigation patch here.
         * The old duplicate transitionToGuild patch was removed because
         * it prevented "View Anyway" from reaching the real router.
         */
        const transitionToGuild = findByProps("transitionToGuild");

        if (transitionToGuild) {
            for (const key of Object.keys(transitionToGuild)) {
                if (typeof transitionToGuild[key] !== "function") {
                    continue;
                }

                unpatches.push(
                    instead(
                        key,
                        transitionToGuild,
                        (args, orig) => {
                            const path = args[0];

                            if (typeof path === "string") {
                                const match = path.match(/(\d+)$/);

                                if (match?.[1]) {
                                    const channelId = match[1];
                                    const channel =
                                        getChannel(channelId);

                                    if (
                                        channel &&
                                        isHidden(channel)
                                    ) {
                                        console.log(
                                            "[HiddenChannels] Hidden channel selected:",
                                            channelId
                                        );

                                        if (storage.showPopup) {
                                            showConfirmationAlert({
                                                title:
                                                    "This channel is hidden.",

                                                content:
                                                    React.createElement(
                                                        AlertContent,
                                                        {
                                                            channel,
                                                        }
                                                    ),

                                                confirmText:
                                                    "View Anyway",

                                                cancelText:
                                                    "Cancel",

                                                onConfirm: () => {
                                                    console.log(
                                                        "[HiddenChannels] View Anyway pressed"
                                                    );

                                                    return orig(...args);
                                                },
                                            });

                                            /*
                                             * Stop the original navigation
                                             * until the user confirms.
                                             */
                                            return {};
                                        }

                                        /*
                                         * Popup disabled:
                                         * immediately allow navigation.
                                         */
                                        return orig(...args);
                                    }
                                }
                            }

                            return orig(...args);
                        }
                    )
                );
            }
        } else {
            console.warn(
                "[HiddenChannels] transitionToGuild not found"
            );
        }

        /*
         * Add a lock icon next to hidden channel names.
         */
        const ChannelInfo = findByName(
            "ChannelInfo",
            false
        );

        if (ChannelInfo && storage.showIcon) {
            unpatches.push(
                after(
                    "default",
                    ChannelInfo,
                    ([{ channel }], result) => {
                        if (!channel || !isHidden(channel)) {
                            return result;
                        }

                        return React.createElement(
                            React.Fragment,
                            null,

                            React.createElement(
                                RN.Image,
                                {
                                    source:
                                        getAssetByName(
                                            "ic_lock"
                                        ).id,

                                    style: {
                                        width: 20,
                                        height: 20,
                                        marginRight: 4,
                                    },
                                }
                            ),

                            result
                        );
                    }
                )
            );
        }
    },

    onUnload: () => {
        console.log(
            "[HiddenChannels] Unloading plugin"
        );

        for (const unpatch of unpatches) {
            unpatch();
        }

        unpatches.length = 0;
    },

    settings: Settings,
};

