// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.ui

import android.content.Context
import android.content.res.Configuration
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.os.Build
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * U2: the small design system the four tabs share. Framework views only (policy_check forbids
 * dependencies): colours for light and dark, an accent that follows the system palette on
 * Android 12+, cards, one filled primary button per screen, text buttons, list rows.
 */
class Palette(ctx: Context) {
    val dark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
        Configuration.UI_MODE_NIGHT_YES

    val background = if (dark) 0xFF121412.toInt() else 0xFFF6F7F5.toInt()
    val surface = if (dark) 0xFF1D201D.toInt() else 0xFFFFFFFF.toInt()
    val text = if (dark) 0xFFE4E6E1.toInt() else 0xFF1B1C1A.toInt()
    val secondary = if (dark) 0xFFA8ADA5.toInt() else 0xFF5B5F59.toInt()
    val outline = if (dark) 0xFF3A3E39.toInt() else 0xFFDADDD7.toInt()
    val danger = if (dark) 0xFFF2B8B5.toInt() else 0xFFB3261E.toInt()
    val dangerContainer = if (dark) 0xFF3B1A18.toInt() else 0xFFFCEAE8.toInt()
    val warn = if (dark) 0xFFE6C17A.toInt() else 0xFF7A5200.toInt()
    val warnContainer = if (dark) 0xFF33290F.toInt() else 0xFFFFF3D6.toInt()

    /** Brand green, or the system accent on Android 12+ (framework colours, no library). */
    val accent: Int = if (Build.VERSION.SDK_INT >= 31) {
        ctx.getColor(if (dark) android.R.color.system_accent1_200 else android.R.color.system_accent1_600)
    } else if (dark) 0xFF7FD3B8.toInt() else 0xFF1F6F5C.toInt()
    val onAccent: Int = if (dark) 0xFF00382C.toInt() else 0xFFFFFFFF.toInt()
    val accentContainer: Int = if (Build.VERSION.SDK_INT >= 31) {
        ctx.getColor(if (dark) android.R.color.system_accent1_800 else android.R.color.system_accent1_100)
    } else if (dark) 0xFF0E3B31.toInt() else 0xFFD6F0E7.toInt()
}

class Ui(val ctx: Context) {
    val p = Palette(ctx)
    private val density = ctx.resources.displayMetrics.density

    fun dp(v: Int): Int = (v * density + 0.5f).toInt()

    private fun rounded(color: Int, radiusDp: Int, strokeColor: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radiusDp).toFloat()
            if (strokeColor != null) setStroke(dp(1), strokeColor)
        }

    private fun ripple(content: Drawable?, mask: Drawable?): Drawable =
        RippleDrawable(ColorStateList.valueOf((p.text and 0x00FFFFFF) or 0x22000000), content, mask)

    fun vertical(paddingDp: Int = 0): LinearLayout = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(paddingDp), dp(paddingDp), dp(paddingDp), dp(paddingDp))
    }

    fun matchWidth(topMarginDp: Int = 0): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(topMarginDp)
        }

    /** A rounded surface that groups related rows. */
    fun card(topMarginDp: Int = 12, container: Int = p.surface): LinearLayout = vertical(16).apply {
        background = rounded(container, 16, if (container == p.surface) p.outline else null)
        layoutParams = matchWidth(topMarginDp)
    }

    fun title(text: CharSequence, sizeSp: Float = 22f): TextView = TextView(ctx).apply {
        this.text = text
        textSize = sizeSp
        setTextColor(p.text)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        // Headings are announced as such by TalkBack (API 28+).
        if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
    }

    fun section(text: CharSequence): TextView = TextView(ctx).apply {
        this.text = text
        textSize = 15f
        setTextColor(p.text)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
        layoutParams = matchWidth(0)
    }

    fun body(text: CharSequence = "", sizeSp: Float = 14f): TextView = TextView(ctx).apply {
        this.text = text
        textSize = sizeSp
        setTextColor(p.text)
        setLineSpacing(0f, 1.15f)
    }

    fun caption(text: CharSequence = ""): TextView = TextView(ctx).apply {
        this.text = text
        textSize = 13f
        setTextColor(p.secondary)
        setLineSpacing(0f, 1.15f)
    }

    /** The one filled button on a screen. 48 dp minimum touch target. */
    fun primaryButton(text: CharSequence, onClick: () -> Unit): Button = Button(ctx).apply {
        this.text = text
        isAllCaps = false
        textSize = 16f
        setTextColor(p.onAccent)
        minHeight = dp(52)
        stateListAnimator = null
        background = ripple(rounded(p.accent, 26), null)
        setOnClickListener { onClick() }
        layoutParams = matchWidth(16)
    }

    /** Outlined secondary action. */
    fun secondaryButton(text: CharSequence, onClick: () -> Unit): Button = Button(ctx).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        setTextColor(p.accent)
        minHeight = dp(48)
        stateListAnimator = null
        background = ripple(rounded(0, 24, p.outline), rounded(0xFFFFFFFF.toInt(), 24))
        setOnClickListener { onClick() }
        layoutParams = matchWidth(8)
    }

    /** Low-emphasis action inside a row or under a card. */
    fun textButton(text: CharSequence, color: Int = p.accent, onClick: () -> Unit): Button = Button(ctx).apply {
        this.text = text
        isAllCaps = false
        textSize = 14f
        setTextColor(color)
        minHeight = dp(48)
        minWidth = dp(48)
        stateListAnimator = null
        background = ripple(null, rounded(0xFFFFFFFF.toInt(), 20))
        setPadding(dp(12), 0, dp(12), 0)
        setOnClickListener { onClick() }
    }

    fun divider(): View = View(ctx).apply {
        setBackgroundColor(p.outline)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)).apply {
            topMargin = dp(8); bottomMargin = dp(8)
        }
    }

    /**
     * A list row: primary text, optional secondary lines, optional trailing button. The texts take the
     * remaining width, so long domains wrap instead of pushing the button off screen.
     */
    fun row(primary: CharSequence, secondaryLines: List<CharSequence> = emptyList(), action: Button? = null): LinearLayout {
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(48)
            setPadding(0, dp(6), 0, dp(6))
            layoutParams = matchWidth(0)
        }
        val texts = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        // One line, shortened in the middle, so a long domain keeps its end (and the count) visible.
        texts.addView(body(primary).apply { maxLines = 1; ellipsize = TextUtils.TruncateAt.MIDDLE })
        for (l in secondaryLines) texts.addView(caption(l))
        row.addView(texts)
        if (action != null) row.addView(action)
        return row
    }

    /** Empty state: one calm sentence instead of an empty box. */
    fun empty(text: CharSequence): TextView = caption(text).apply {
        setPadding(0, dp(8), 0, dp(8))
    }

    fun tinted(resId: Int, color: Int): Drawable? =
        ctx.getDrawable(resId)?.mutate()?.apply { setTint(color) }
}
