import { findByProps, findByName } from "@vendetta/metro";
import { constants, React, ReactNative as RN } from "@vendetta/metro/common";
import AlertContent from "./AlertContent";
import { Settings } from "./settings";
import { getAssetByName } from "@vendetta/ui/assets";
import { after, instead } from "@vendetta/patcher";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { storage } from "@vendetta/plugin";

const Permissions = findByProps("getChannelPermissions", "can");

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

function shouldBypassPermission(permID: any) {
    return (
        permID === constants.Permissions.VIEW_CHANNEL ||
        permID === constants.Permissions.READ_MESSAGE_HISTORY ||
        permID === constants.Permissions.SEND_MESSAGES
    );
}

console.log("[HiddenChannels] Plugin loaded");

const unpatches: (() => void)[] = [];

export default {
    onLoad: () => {
        storage.showIcon ??= true;
        storage.showPopup ??= true;

        /*
         * Bypass the client-side permission checks needed to
         * actually display and use the channel.
         *
         * realCheck prevents this hook from interfering with
         * our own isHidden() check.
         */
        unpatches.push(
            after(
                "can",
                Permissions,
                ([permID, channel], result) => {
                    if (channel?.realCheck) {
                        return result;
                    }

                    if (
                        channel &&
                        shouldBypassPermission(permID)
                    ) {
                        return true;
                    }

                    return result;
                }
            )
        );

        /*
         * Intercept navigation to hidden channels.
         */
        const transitionToGuild =
            findByProps("transitionToGuild");

        if (transitionToGuild) {
            for (const key of Object.keys(transitionToGuild)) {
                if (
                    typeof transitionToGuild[key] !==
                    "function"
                ) {
                    continue;
                }

                unpatches.push(
                    instead(
                        key,
                        transitionToGuild,
                        (args, orig) => {
                            if (
                                typeof args[0] === "string"
                            ) {
                                const pathMatch =
                                    args[0].match(/(\d+)$/);

                                if (pathMatch?.[1]) {
                                    const channelId =
                                        pathMatch[1];

                                    const channel =
                                        getChannel(channelId);

                                    if (
                                        channel &&
                                        isHidden(channel)
                                    ) {
                                        if (
                                            storage.showPopup
                                        ) {
                                            showConfirmationAlert(
                                                {
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

                                                    onConfirm:
                                                        () => {
                                                            console.log(
                                                                "[HiddenChannels] Entering hidden channel:",
                                                                channelId
                                                            );

                                                            orig(
                                                                ...args
                                                            );
                                                        },
                                                }
                                            );

                                            return {};
                                        }

                                        return orig(
                                            ...args
                                        );
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
         * Add the lock icon to hidden channel headers.
         */
        const ChannelInfo =
            findByName("ChannelInfo", false);

        if (ChannelInfo && storage.showIcon) {
            unpatches.push(
                after(
                    "default",
                    ChannelInfo,
                    ([{ channel }], ret) =>
                        React.createElement(
                            React.Fragment,
                            {},
                            channel &&
                            isHidden(channel)
                                ? React.createElement(
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
                                  )
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
