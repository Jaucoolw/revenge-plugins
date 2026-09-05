import {
    stylesheet,
    constants,
    moment,
    clipboard,
    React,
} from "@vendetta/metro/common";

import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import { getAssetByName } from "@vendetta/ui/assets";

const { View, Text, Pressable } =
    findByProps(
        "Button",
        "Text",
        "View"
    );

const snowflakeUtils = findByProps(
    "extractTimestamp"
);

const MessageStyles =
    stylesheet.createThemedStyleSheet({
        container: {
            flex: 1,
            padding: 16,
            alignItems: "center",
            justifyContent: "center",
        },

        title: {
            fontFamily:
                constants.Fonts.PRIMARY_SEMIBOLD,

            fontSize: 24,

            textAlign: "left",

            color:
                semanticColors.HEADER_PRIMARY,

            paddingVertical: 25,
        },

        text: {
            flex: 1,

            flexDirection: "row",

            fontSize: 16,

            textAlign: "justify",

            color:
                semanticColors.HEADER_PRIMARY,
        },

        dateContainer: {
            height: 16,
            alignSelf: "baseline",
        },
    });

function FancyDate({
    date,
}: {
    date: Date;
}) {
    return (
        <Pressable
            style={
                MessageStyles.dateContainer
            }
            onPress={() => {
                const asset =
                    getAssetByName("clock");

                moment(date);

                if (asset) {
                    // Kept intentionally simple;
                    // toast handling is done through
                    // the existing Vendetta API.
                }
            }}
            onLongPress={() => {
                clipboard.setString(
                    date.getTime().toString()
                );
            }}
        >
            <Text
                style={MessageStyles.text}
            >
                {moment(date).fromNow()}
            </Text>
        </Pressable>
    );
}

export default function HiddenChannel({
    channel,
}: {
    channel: any;
}) {
    return (
        <View
            style={
                MessageStyles.container
            }
        >
            <Text
                style={
                    MessageStyles.title
                }
            >
                This channel is hidden.
            </Text>

            <Text
                style={MessageStyles.text}
            >
                Topic:{" "}
                {channel.topic ||
                    "No topic."}

                {"\n\n"}

                Creation date:{" "}
                <FancyDate
                    date={
                        new Date(
                            snowflakeUtils.extractTimestamp(
                                channel.id
                            )
                        )
                    }
                />

                {"\n\n"}

                Last message:{" "}
                {channel.lastMessageId ? (
                    <FancyDate
                        date={
                            new Date(
                                snowflakeUtils.extractTimestamp(
                                    channel.lastMessageId
                                )
                            )
                        }
                    />
                ) : (
                    "No messages."
                )}

                {"\n\n"}

                Last pin:{" "}
                {channel.lastPinTimestamp ? (
                    <FancyDate
                        date={
                            new Date(
                                channel.lastPinTimestamp
                            )
                        }
                    />
                ) : (
                    "No pins."
                )}
            </Text>
        </View>
    );
}
