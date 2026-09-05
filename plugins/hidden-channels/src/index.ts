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

    /*
     * Tell our own permission check to use the real permission.
     */
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
         * Make Discord's normal VIEW_CHANNEL checks pass.
         *
         * This is intentionally NOT applied while isHidden()
         * is performing the real permission check.
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
         * Navigation handling.
         *
         * Hidden channels get the confirmation popup.
         * "View Anyway" calls Discord's original navigation
         * function, so the normal channel UI is used.
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
                                typeof args[0] ===
                                "string"
                            ) {
                                const pathMatch =
                                    args[0].match(/(\d+)$/);

                                if (pathMatch?.[1]) {
                                    const channelId =
                                        pathMatch[1];

                                    const channel =
                                        getChannel(
                                            channelId
                                        );

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
                                                                "[HiddenChannels] Allowing navigation to hidden channel:",
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

                                        /*
                                         * Popup disabled:
                                         * just enter normally.
                                         */
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
         * Lock icon in the channel header.
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
