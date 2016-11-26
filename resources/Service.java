/* MIT License
 *
 * Copyright (c) 2016 schreiben
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import org.languagetool.AnalyzedSentence;
import org.languagetool.JLanguageTool;
import org.languagetool.Language;
import org.languagetool.Languages;
import org.languagetool.rules.ITSIssueType;
import org.languagetool.rules.Category;
import org.languagetool.rules.CategoryId;
import org.languagetool.rules.Rule;
import org.languagetool.rules.RuleMatch;
import org.languagetool.rules.patterns.AbstractPatternRule;
import org.languagetool.tools.StringTools;

import java.io.IOException;
import java.util.Scanner;
import java.util.Arrays;
import java.util.List;
import java.io.StringWriter;

public class Service {

  private static final JsonFactory factory = new JsonFactory();

  private static String substituteSuggestion(String s) throws IOException {
    return s.replace("<suggestion>", "\"").replace("</suggestion>", "\"");
  }

  private static String codeResponse(int code) {
    StringWriter sw = new StringWriter();
    try {
      try (JsonGenerator g = factory.createGenerator(sw)) {
        g.writeStartObject();
          g.writeNumberField("code", code);
        g.writeEndObject();
      }
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    return sw.toString();
  }

  public static void main(String[] args) {

    StringWriter sw = new StringWriter();
    try {
      try (JsonGenerator g = factory.createGenerator(sw)) {
        g.writeStartObject();
          g.writeNumberField("code", 200);
          g.writeArrayFieldStart("languages");
            for (Language l : Languages.get()) {
              g.writeStartObject();
                g.writeStringField("name", l.getName());
                g.writeStringField(
                  "locale",
                  l.getLocaleWithCountryAndVariant().toString()
                );
              g.writeEndObject();
            }
          g.writeEndArray();
        g.writeEndObject();
      }
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    String languagesResponse = sw.toString();

    String errorResponse = codeResponse(500);
    String okResponse = codeResponse(200);

    Scanner sc = new Scanner(System.in);
    while(sc.hasNextLine()) {
      String line = sc.nextLine();
      if(line.startsWith("C:")) {
        int i1 = 2;
        int i2 = line.indexOf(":", 2);
        String text = line.substring(i1, i2);
        sw = new StringWriter();
        try {
          try (JsonGenerator g = factory.createGenerator(sw)) {
            g.writeStartObject();
              g.writeNumberField("code", 200);
              g.writeArrayFieldStart("matches");
              for (RuleMatch match :
                new JLanguageTool(
                  Languages.getLanguageForShortName(text)
                ).check(line.substring(i2 + 1))
              ) {
                g.writeStartObject();

                  g.writeNumberField("offset", match.getFromPos());

                  g.writeNumberField(
                    "length",
                    match.getToPos()-match.getFromPos()
                  );

                  g.writeStringField(
                    "message",
                    substituteSuggestion(match.getMessage())
                  );

                  if (match.getShortMessage() != null) {
                    g.writeStringField(
                      "shortMessage",
                      substituteSuggestion(match.getShortMessage())
                    );
                  }

                  g.writeArrayFieldStart("replacements");
                  for (String replacement : match.getSuggestedReplacements()) {
                    g.writeString(replacement);
                  }
                  g.writeEndArray();

                  Rule rule = match.getRule();

                  g.writeStringField("ruleId", rule.getId());

                  if (rule instanceof AbstractPatternRule) {
                    String subId = ((AbstractPatternRule) rule).getSubId();
                    if (subId != null) {
                      g.writeStringField("ruleSubId", subId);
                    }
                  }

                  g.writeStringField("ruleDescription", rule.getDescription());

                  g.writeStringField(
                    "ruleIssueType",
                    rule.getLocQualityIssueType().toString()
                  );

                  if (rule.getUrl() != null) {
                    g.writeArrayFieldStart("ruleUrls");
                      g.writeString(rule.getUrl().toString());
                    g.writeEndArray();
                  }

                  Category category = rule.getCategory();
                  CategoryId catId = category.getId();
                  if (catId != null) {
                    g.writeStringField("ruleCategoryId", catId.toString());

                    g.writeStringField("ruleCategoryName", category.getName());
                  }

                g.writeEndObject();
              }
              g.writeEndArray();
            g.writeEndObject();
          }
        } catch (IOException e) {
          throw new RuntimeException(e);
        }
        System.out.println(sw.toString());
      } else if (line.startsWith("L")) {
        System.out.println(languagesResponse);
      } else if (line.startsWith("Q")) {
        System.out.println(okResponse);
        return;
      } else
        System.out.println(errorResponse);
    }
  }
}
