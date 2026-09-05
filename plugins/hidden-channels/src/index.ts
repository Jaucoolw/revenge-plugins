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
         * Make normal client-side VIEW_CHANNEL checks succeed.
         * isHidden() temporarily sets realCheck so that its own
         * permission check still gets the real result.
         */
        unpatches.push(
            after("can", Permissions, ([permID, channel], result) => {
                if (
                    !channel?.realCheck &&
                    permID === constants.Permissions.VIEW_CHANNEL
                ) {
                    return true;
                }

                return result;
            })
        );

        /*
         * Don't fetch messages for hidden channels.
         */
        if (Fetcher?.fetchMessages) {
            unpatches.push(
                instead("fetchMessages", Fetcher, (args, orig) => {
                    const channel = args[0];

                    if (!isHidden(channel)) {
                        return orig(...args);
                    }

                    console.log(
                        "[HiddenChannels] Blocked message fetch for hidden channel"
                    );

                    return;
                })
            );
        } else {
            console.warn(
                "[HiddenChannels] Fetcher.fetchMessages not found"
            );
        }

        /*
         * Handle navigation to hidden channels.
         *
         * IMPORTANT:
         * There is intentionally only ONE navigation patch here.
         * Having another transitionToGuild patch caused
         * "View Anyway" to navigate into a blank screen.
         */
        const transitionToGuild = findByProps("transitionToGuild");

        if (transitionToGuild) {
            for (const key of Object.keys(transitionToGuild)) {
                if (typeof transitionToGuild[key] !== "function") {
                    continue;
                }

                unpatches.push(
                    instead(key, transitionToGuild, (args, orig) => {
                        if (typeof args[0] === "string") {
                            const pathMatch = args[0].match(/(\d+)$/);

                            if (pathMatch?.[1]) {
                                const channelId = pathMatch[1];
                                const channel = getChannel(channelId);

                                if (channel && isHidden(channel)) {
                                    if (storage.showPopup) {
                                        showConfirmationAlert({
                                            title: "This channel is hidden.",
                                            content: React.createElement(
                                                AlertContent,
                                                { channel }
                                            ),
                                            confirmText: "View Anyway",
                                            cancelText: "Cancel",
                                            onConfirm: () => {
                                                orig(...args);
                                            },
                                        });

                                        return {};
                                    }

                                    return orig(...args);
                                }
                            }
                        }

                        return orig(...args);
                    })
                );
            }
        } else {
            console.warn(
                "[HiddenChannels] transitionToGuild not found"
            );
        }

        /*
         * Add lock icon to hidden channel headers.
         */
        const ChannelInfo = findByName("ChannelInfo", false);

        if (ChannelInfo && storage.showIcon) {
            unpatches.push(
                after(
                    "default",
                    ChannelInfo,
                    ([{ channel }], ret) =>
                        React.createElement(
                            React.Fragment,
                            {},
                            channel && isHidden(channel)
                                ? React.createElement(RN.Image, {
                                      source:
                                          getAssetByName("ic_lock").id,
                                      style: {
                                          width: 20,
                                          height: 20,
                                          marginRight: 4,
                                      },
                                  })
                                : null,
                            ret
                        )
                )
            );
        }
    },

    onUnload: () => {
        for (const unpatch of unpatches) {
            unpatch();
        }
    },

    settings: Settings,
};
